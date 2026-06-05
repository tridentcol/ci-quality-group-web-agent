import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, webhookEvents } from '@/lib/db/schema'
import { generateReply } from '@/lib/ai/generate'
import { appendMessage, countMessages, loadMemory } from '@/lib/ai/memory'
import { inngest } from '@/inngest/client'
import { sendText, sendImage } from './send'
import type { NormalizedEvent } from './normalize'

/** A partir de cuántos mensajes pedir un resumen de la conversación. */
const SUMMARIZE_AT = 12

/**
 * Pipeline por evento (blueprint §9 Step 10): idempotencia → echo/relevo →
 * memoria → generación RAG → envío. No lanza hacia afuera salvo errores graves;
 * el webhook ya respondió 200 y ejecuta esto en segundo plano.
 */
export async function handleEvent(e: NormalizedEvent): Promise<void> {
  // 1) Idempotencia: si ya procesamos este messageId, salir.
  const [fresh] = await db
    .insert(webhookEvents)
    .values({ eventId: e.messageId })
    .onConflictDoNothing()
    .returning({ eventId: webhookEvents.eventId })
  if (!fresh) return

  const mem = await loadMemory(e.channel, e.externalId)

  // 2) Echo: un humano respondió desde la bandeja de Meta → tomar el control.
  if (e.isEcho) {
    await db
      .update(conversations)
      .set({ status: 'human_controlled' })
      .where(eq(conversations.id, mem.conversationId))
    await appendMessage(mem.conversationId, 'human_agent', e.text, e.messageId)
    return
  }

  // 3) Guardar el mensaje entrante del cliente.
  await appendMessage(mem.conversationId, 'user', e.text, e.messageId)

  // 4) Si un humano lleva el hilo, el bot no responde.
  if (mem.status === 'human_controlled') return

  // 5) Generar respuesta (RAG + router + tools) con la memoria cargada.
  const res = await generateReply({
    message: e.text,
    history: mem.history,
    conversationId: mem.conversationId,
    customerSummary: mem.customerSummary,
    conversationSummary: mem.summary,
  })

  // 6) Enviar y persistir la respuesta del bot (con trazabilidad del turno).
  if (res.reply.trim()) {
    await appendMessage(mem.conversationId, 'assistant', res.reply, undefined, {
      model: res.model,
      routerReason: res.routerReason,
      contextUsed: res.contextUsed,
      topScores: res.retrieved.slice(0, 3).map((r) => Number(r.similarity.toFixed(3))),
      tools: res.toolCalls.map((t) => t.name),
    })
    await sendText(e.channel, e.externalId, res.reply)
  }

  // 6b) Imágenes ilustrativas que el bot decidió adjuntar (find_image).
  for (const att of res.attachments) {
    try {
      await sendImage(e.channel, e.externalId, att.url, att.caption)
    } catch {
      // si falla el envío de una imagen, no rompemos la conversación
    }
  }

  // 7) Resumen periódico para acotar tokens en conversaciones largas.
  if ((await countMessages(mem.conversationId)) > SUMMARIZE_AT) {
    await inngest.send({
      name: 'memory/conversation.summarize',
      data: { conversationId: mem.conversationId },
    })
  }
}
