import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig, conversations, customerProfiles, webhookEvents } from '@/lib/db/schema'
import { generateReply } from '@/lib/ai/generate'
import { appendMessage, countMessages, loadMemory } from '@/lib/ai/memory'
import { inngest } from '@/inngest/client'
import { sendText, sendMedia } from './send'
import type { Channel, NormalizedEvent } from './normalize'

/** A partir de cuántos mensajes pedir un resumen de la conversación. */
const SUMMARIZE_AT = 12

/** ¿El canal está habilitado en bot_config? Ausente o sin config → habilitado. */
async function channelEnabled(channel: Channel): Promise<boolean> {
  const [cfg] = await db
    .select({ channels: botConfig.channelsEnabled })
    .from(botConfig)
    .where(eq(botConfig.id, 1))
  const ch = (cfg?.channels ?? {}) as Record<string, boolean>
  return ch[channel] !== false
}

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

  // Persistir el nombre del cliente (lo trae WhatsApp) si aún no lo tenemos.
  if (e.customerName) {
    await db
      .update(conversations)
      .set({ customerName: e.customerName })
      .where(and(eq(conversations.id, mem.conversationId), isNull(conversations.customerName)))
    await db
      .update(customerProfiles)
      .set({ name: e.customerName })
      .where(and(eq(customerProfiles.id, mem.customerId), isNull(customerProfiles.name)))
  }

  // 2) Echo: un humano respondió desde la bandeja de Meta → tomar el control.
  if (e.isEcho) {
    await db
      .update(conversations)
      .set({ status: 'human_controlled' })
      .where(eq(conversations.id, mem.conversationId))
    await appendMessage(mem.conversationId, 'human_agent', e.text, e.messageId)
    // El humano cierra el turno del bot → actualizar el perfil de largo plazo.
    await inngest.send({
      name: 'memory/conversation.ended',
      data: { conversationId: mem.conversationId },
    })
    return
  }

  // 3) Guardar el mensaje entrante del cliente.
  await appendMessage(mem.conversationId, 'user', e.text, e.messageId)

  // 4) Si un humano lleva el hilo, el bot no responde.
  if (mem.status === 'human_controlled') return

  // 4b) Si el canal está desactivado en Ajustes, no responder (queda registrado).
  if (!(await channelEnabled(e.channel))) return

  // 5) Generar respuesta (RAG + router + tools) con la memoria cargada.
  const res = await generateReply({
    message: e.text,
    history: mem.history,
    conversationId: mem.conversationId,
    customerSummary: mem.customerSummary,
    conversationSummary: mem.summary,
  })

  // 6) Enviar PRIMERO y persistir después: así no queda registrado como enviado
  //    un mensaje que el envío no logró entregar.
  if (res.reply.trim()) {
    await sendText(e.channel, e.externalId, res.reply)
    await appendMessage(mem.conversationId, 'assistant', res.reply, undefined, {
      model: res.model,
      routerReason: res.routerReason,
      contextUsed: res.contextUsed,
      topScores: res.retrieved.slice(0, 3).map((r) => Number(r.similarity.toFixed(3))),
      tools: res.toolCalls.map((t) => t.name),
    })
  }

  // 6b) Medios ilustrativos (imagen/video) que acompañan la respuesta.
  for (const att of res.attachments) {
    try {
      await sendMedia(e.channel, e.externalId, att)
    } catch {
      // si falla el envío de un medio, no rompemos la conversación
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
