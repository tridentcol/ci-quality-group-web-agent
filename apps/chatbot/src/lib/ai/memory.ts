import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, customerProfiles, messages } from '@/lib/db/schema'
import type { ChatTurn } from './generate'

/**
 * Memoria del bot (blueprint §9 Step 9B), 3 capas:
 *  - corto plazo: últimos N `messages` de la conversación (→ history de generate)
 *  - largo plazo: `customer_profiles.facts` por (channel, external_id), resumido
 *    e inyectado en el system prompt (`customerSummary`)
 *  - conocimiento: RAG (vive en retrieve/generate)
 *
 * Este módulo resuelve la conversación + el perfil, carga el historial y
 * persiste turnos. Los jobs Inngest memory/update-profile y memory/summarize
 * mantienen `facts` y `conversations.summary` al día.
 */

export const HISTORY_LIMIT = 10

/** Forma estable de `customer_profiles.facts` (jsonb). Todo opcional. */
export interface CustomerFacts {
  materialsOfInterest?: string[]
  typicalVolume?: string
  buyerOrSeller?: 'compra' | 'vende' | 'ambos'
  preferences?: string
  notes?: string
}

export interface ConversationMemory {
  conversationId: string
  customerId: string
  /** Resumen de la memoria de largo plazo para el system prompt (o null). */
  customerSummary: string | null
  /** Resumen acumulado de la conversación larga (conversations.summary). */
  summary: string | null
  /** Historial reciente (corto plazo), del más antiguo al más nuevo. */
  history: ChatTurn[]
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseFacts(raw: unknown): CustomerFacts {
  if (!isObj(raw)) return {}
  const f = raw as Record<string, unknown>
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const bos = str(f.buyerOrSeller)
  return {
    materialsOfInterest: arr(f.materialsOfInterest),
    typicalVolume: str(f.typicalVolume),
    buyerOrSeller: bos === 'compra' || bos === 'vende' || bos === 'ambos' ? bos : undefined,
    preferences: str(f.preferences),
    notes: str(f.notes),
  }
}

/** Une hechos previos con los recién extraídos (arrays se unen sin duplicar). */
export function mergeFacts(prev: CustomerFacts, next: CustomerFacts): CustomerFacts {
  const union = (a?: string[], b?: string[]) => {
    const seen = new Map<string, string>()
    for (const x of [...(a ?? []), ...(b ?? [])]) {
      const k = x.trim().toLowerCase()
      if (k && !seen.has(k)) seen.set(k, x.trim())
    }
    return seen.size ? [...seen.values()] : undefined
  }
  return {
    materialsOfInterest: union(prev.materialsOfInterest, next.materialsOfInterest),
    typicalVolume: next.typicalVolume ?? prev.typicalVolume,
    buyerOrSeller: next.buyerOrSeller ?? prev.buyerOrSeller,
    preferences: next.preferences ?? prev.preferences,
    notes: next.notes ?? prev.notes,
  }
}

/** Construye el resumen de largo plazo para el system prompt (o null si vacío). */
export function buildCustomerSummary(input: {
  name?: string | null
  company?: string | null
  facts?: unknown
}): string | null {
  const f = parseFacts(input.facts)
  const parts: string[] = []

  const who = [input.name?.trim(), input.company?.trim() ? `(${input.company.trim()})` : null]
    .filter(Boolean)
    .join(' ')
  if (who) parts.push(`Cliente recurrente: ${who}.`)

  if (f.materialsOfInterest?.length) parts.push(`Interesado en: ${f.materialsOfInterest.join(', ')}.`)
  if (f.buyerOrSeller) {
    const verb = f.buyerOrSeller === 'compra' ? 'suele comprar' : f.buyerOrSeller === 'vende' ? 'suele vender' : 'compra y vende'
    parts.push(`${verb}${f.typicalVolume ? ` (${f.typicalVolume})` : ''}.`)
  } else if (f.typicalVolume) {
    parts.push(`Volumen típico: ${f.typicalVolume}.`)
  }
  if (f.preferences) parts.push(`Preferencias: ${f.preferences}.`)
  if (f.notes) parts.push(f.notes)

  return parts.length ? parts.join(' ') : null
}

// ─── conversación + perfil ────────────────────────────────────────────────────

/** Devuelve (o crea) el perfil de cliente para un (channel, externalId). */
export async function getOrCreateProfile(channel: string, externalId: string) {
  const [existing] = await db
    .select()
    .from(customerProfiles)
    .where(and(eq(customerProfiles.channel, channel), eq(customerProfiles.externalId, externalId)))
  if (existing) return existing

  const [created] = await db
    .insert(customerProfiles)
    .values({ channel, externalId })
    .onConflictDoNothing({
      target: [customerProfiles.channel, customerProfiles.externalId],
    })
    .returning()
  if (created) return created

  // Carrera: otro proceso lo creó entre el select y el insert.
  const [row] = await db
    .select()
    .from(customerProfiles)
    .where(and(eq(customerProfiles.channel, channel), eq(customerProfiles.externalId, externalId)))
  return row
}

/** Devuelve (o crea) la conversación de un (channel, externalId), enlazada al perfil. */
export async function getOrCreateConversation(channel: string, externalId: string, customerId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.channel, channel), eq(conversations.externalId, externalId)))
  if (existing) {
    if (!existing.customerId) {
      await db.update(conversations).set({ customerId }).where(eq(conversations.id, existing.id))
      existing.customerId = customerId
    }
    return existing
  }

  const [created] = await db
    .insert(conversations)
    .values({ channel, externalId, customerId })
    .onConflictDoNothing({ target: [conversations.channel, conversations.externalId] })
    .returning()
  if (created) return created

  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.channel, channel), eq(conversations.externalId, externalId)))
  return row
}

/** Carga el historial reciente como turnos para el modelo (human_agent→assistant). */
export async function loadRecentMessages(conversationId: string, limit = HISTORY_LIMIT): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)

  return rows
    .reverse()
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
}

/** Persiste un turno de la conversación y actualiza last_message_at. */
export async function appendMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'human_agent' | 'system',
  content: string,
  channelMessageId?: string,
) {
  const [row] = await db
    .insert(messages)
    .values({ conversationId, role, content, channelMessageId: channelMessageId ?? null })
    .returning({ id: messages.id })
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId))
  return row.id
}

/**
 * Carga las 3 capas de memoria para arrancar/continuar una conversación:
 * resuelve perfil + conversación, marca lastSeen y devuelve summary/history.
 */
export async function loadMemory(channel: string, externalId: string): Promise<ConversationMemory> {
  const profile = await getOrCreateProfile(channel, externalId)
  const conversation = await getOrCreateConversation(channel, externalId, profile.id)

  await db
    .update(customerProfiles)
    .set({ lastSeenAt: new Date() })
    .where(eq(customerProfiles.id, profile.id))

  const history = await loadRecentMessages(conversation.id)
  const customerSummary = buildCustomerSummary({
    name: profile.name,
    company: profile.company,
    facts: profile.facts,
  })

  return {
    conversationId: conversation.id,
    customerId: profile.id,
    customerSummary,
    summary: conversation.summary,
    history,
  }
}

/** Cuenta mensajes de una conversación (para decidir si toca resumir). */
export async function countMessages(conversationId: string): Promise<number> {
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
  return rows.length
}
