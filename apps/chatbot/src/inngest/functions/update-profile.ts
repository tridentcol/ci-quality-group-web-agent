import { asc, eq } from 'drizzle-orm'
import { inngest } from '@/inngest/client'
import { db } from '@/lib/db'
import { conversations, customerProfiles, messages } from '@/lib/db/schema'
import { openai } from '@/lib/ai/openai'
import { mergeFacts, parseFacts } from '@/lib/ai/memory'

const EXTRACT_MODEL = 'gpt-4o-mini'

const EXTRACT_PROMPT = `Extrae de la conversación los datos del cliente para su perfil de largo plazo.
Devuelve SOLO un objeto JSON con esta forma (omite las claves que no sepas con certeza; no inventes):
{
  "name": string,            // nombre del cliente si lo dijo
  "company": string,         // empresa si la mencionó
  "contact": string,         // teléfono o email si lo dio
  "facts": {
    "materialsOfInterest": string[],          // materiales/servicios que le interesan
    "typicalVolume": string,                  // volumen/cantidad típica (ej. "200 kg", "por tonelada")
    "buyerOrSeller": "compra" | "vende" | "ambos",
    "preferences": string,                    // preferencias relevantes
    "notes": string                           // cualquier dato útil y duradero
  }
}
Usa español. Si no hay nada que valga la pena guardar, devuelve {}.`

const safeJson = (s: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(s || '{}')
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * memory/update-profile (blueprint §9 Step 9B): al cerrar/inactivarse una
 * conversación, extrae con el modelo los hechos duraderos del cliente y los
 * fusiona en customer_profiles.facts (+ name/company/contact si se aprendieron).
 */
export const updateProfile = inngest.createFunction(
  {
    id: 'memory-update-profile',
    name: 'Memoria: actualizar perfil de cliente',
    triggers: [{ event: 'memory/conversation.ended' }],
  },
  async ({ event, step }) => {
    const { conversationId } = event.data

    const data = await step.run('load', async () => {
      const [conv] = await db
        .select({ customerId: conversations.customerId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
      if (!conv?.customerId) return null

      const msgs = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))

      const [profile] = await db
        .select({ facts: customerProfiles.facts })
        .from(customerProfiles)
        .where(eq(customerProfiles.id, conv.customerId))

      return { customerId: conv.customerId, msgs, prevFacts: profile?.facts ?? null }
    })

    if (!data || data.msgs.length === 0) return { skipped: 'sin mensajes o sin perfil' }

    const extracted = await step.run('extract', async () => {
      const transcript = data.msgs
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
        .join('\n')
      const completion = await openai.chat.completions.create({
        model: EXTRACT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT_PROMPT },
          { role: 'user', content: transcript },
        ],
      })
      return completion.choices[0].message.content ?? '{}'
    })

    const saved = await step.run('merge-save', async () => {
      const parsed = safeJson(extracted)
      const merged = mergeFacts(parseFacts(data.prevFacts), parseFacts(parsed.facts))

      const set: Record<string, unknown> = { facts: merged }
      if (typeof parsed.name === 'string' && parsed.name.trim()) set.name = parsed.name.trim()
      if (typeof parsed.company === 'string' && parsed.company.trim()) set.company = parsed.company.trim()
      if (typeof parsed.contact === 'string' && parsed.contact.trim()) set.contact = parsed.contact.trim()

      await db.update(customerProfiles).set(set).where(eq(customerProfiles.id, data.customerId))
      return merged
    })

    return { customerId: data.customerId, facts: saved }
  },
)
