import { asc, eq } from 'drizzle-orm'
import { inngest } from '@/inngest/client'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'
import { openai } from '@/lib/ai/openai'
import { HISTORY_LIMIT } from '@/lib/ai/memory'

const SUMMARY_MODEL = 'gpt-4o-mini'
// Resumir cuando la conversación supere este nº de mensajes.
const SUMMARY_THRESHOLD = 12

const SUMMARY_PROMPT = `Eres un asistente que mantiene un resumen breve y factual de una conversación de atención al cliente (chatarra/chatarrización/disposición de desechos, Colombia).
Integra el resumen previo (si lo hay) con los mensajes nuevos en UN solo resumen actualizado.
Conserva datos duraderos y útiles para continuar: necesidades, materiales y cantidades, precios cotizados, acuerdos, datos de contacto, estado/pendientes. Omite saludos y relleno.
Español, en tercera persona, máximo ~120 palabras. Devuelve solo el resumen.`

/**
 * memory/summarize (blueprint §9 Step 9B): cuando una conversación crece, resume
 * los mensajes antiguos (todos menos los últimos HISTORY_LIMIT) junto con el
 * resumen previo en conversations.summary, para acotar tokens.
 *
 * INCREMENTAL: solo se resumen los mensajes MÁS ALLÁ de `summarizedCount` (el
 * marcador de hasta dónde ya quedó reflejado en `summary`), no toda la
 * conversación de nuevo en cada disparo — antes, en una conversación de 70
 * mensajes esto se disparaba ~58 veces reenviando cada vez un transcript "viejo"
 * cada vez más largo (costo de OpenAI creciendo sin límite con la conversación).
 */
export const summarizeConversation = inngest.createFunction(
  {
    id: 'memory-summarize',
    name: 'Memoria: resumir conversación',
    triggers: [{ event: 'memory/conversation.summarize' }],
  },
  async ({ event, step }) => {
    const { conversationId } = event.data

    const data = await step.run('load', async () => {
      const [conv] = await db
        .select({ summary: conversations.summary, summarizedCount: conversations.summarizedCount })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
      if (!conv) return null

      const msgs = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))

      return { prevSummary: conv.summary, summarizedCount: conv.summarizedCount, msgs }
    })

    if (!data) return { skipped: 'conversación inexistente' }
    if (data.msgs.length <= SUMMARY_THRESHOLD) return { skipped: 'aún corta' }

    // Ventana "vieja" total (todo menos los últimos HISTORY_LIMIT, que se mantienen
    // como contexto vivo) y, dentro de esa, solo lo NUEVO desde el último resumen.
    const oldEnd = Math.max(0, data.msgs.length - HISTORY_LIMIT)
    const startAt = Math.max(data.summarizedCount, 0)
    if (oldEnd <= startAt) return { skipped: 'nada nuevo que resumir' }
    const older = data.msgs.slice(startAt, oldEnd)
    if (older.length === 0) return { skipped: 'nada antiguo que resumir' }

    const summary = await step.run('summarize', async () => {
      const transcript = older
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
        .join('\n')
      const user = data.prevSummary
        ? `Resumen previo:\n${data.prevSummary}\n\nMensajes nuevos:\n${transcript}`
        : `Mensajes:\n${transcript}`
      const completion = await openai.chat.completions.create({
        model: SUMMARY_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: user },
        ],
      })
      return completion.choices[0].message.content?.trim() ?? ''
    })

    if (!summary) return { skipped: 'resumen vacío' }

    await step.run('save', async () => {
      await db
        .update(conversations)
        .set({ summary, summarizedCount: oldEnd })
        .where(eq(conversations.id, conversationId))
    })

    return { conversationId, summaryLength: summary.length, summarizedThrough: oldEnd }
  },
)
