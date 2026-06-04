import type OpenAI from 'openai'
import { z } from 'zod'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, knowledgeGaps, leads, materials } from '@/lib/db/schema'
import { notifyAdmin } from '@/lib/meta/notify'
import { retrieve } from './retrieve'

/**
 * Tools del bot (blueprint §9 Step 8). Cada tool tiene:
 *  - una definición para function-calling de OpenAI (`toolDefinitions`)
 *  - un ejecutor que valida args con Zod y actúa contra la BD/servicios
 *  - despacho central en `executeTool(name, rawArgs, ctx)`
 *
 * Reglas no negociables: el bot NUNCA inventa precios (solo `lookup_price`
 * desde `materials`); si no hay respuesta en el conocimiento → `log_knowledge_gap`
 * y derivar. Los descuentos por encima de `max_auto_discount_pct` no los aprueba
 * el bot: captura el lead y avisa al admin.
 */

export interface ToolContext {
  /** Conversación actual; requerido por capture_lead, handoff y log_knowledge_gap. */
  conversationId?: string
}

const num = (v: string | null | undefined) => (v == null ? null : Number(v))

// ─── lookup_price ────────────────────────────────────────────────────────────

const lookupPriceArgs = z.object({
  material: z.string().trim().min(1),
  quantity: z.coerce.number().positive().optional(),
})

export type LookupPriceResult =
  | { available: false; reason: 'not_found' | 'inactive'; material: string }
  | {
      available: true
      material: string
      unit: string
      tier: 'retail' | 'wholesale'
      unitPriceCop: number
      quantity?: number
      totalCop?: number
    }

export async function lookupPrice(
  args: z.infer<typeof lookupPriceArgs>,
): Promise<LookupPriceResult> {
  const q = args.material.trim()
  const rows = await db
    .select()
    .from(materials)
    .where(ilike(materials.name, `%${q}%`))

  if (rows.length === 0) return { available: false, reason: 'not_found', material: q }

  // Preferir coincidencia exacta (case-insensitive); si no, la primera.
  const exact = rows.find((r) => r.name.toLowerCase() === q.toLowerCase())
  const m = exact ?? rows[0]

  if (!m.active) return { available: false, reason: 'inactive', material: m.name }

  const retail = num(m.retailPriceCop)!
  const wholesale = num(m.wholesalePriceCop)
  const threshold = num(m.wholesaleThreshold)

  const useWholesale =
    args.quantity != null &&
    wholesale != null &&
    threshold != null &&
    args.quantity >= threshold

  const unitPriceCop = useWholesale ? wholesale! : retail
  const tier: 'retail' | 'wholesale' = useWholesale ? 'wholesale' : 'retail'

  return {
    available: true,
    material: m.name,
    unit: m.unit,
    tier,
    unitPriceCop,
    ...(args.quantity != null
      ? { quantity: args.quantity, totalCop: unitPriceCop * args.quantity }
      : {}),
  }
}

// ─── capture_lead ─────────────────────────────────────────────────────────────

const captureLeadArgs = z.object({
  name: z.string().trim().min(1).optional(),
  contact: z.string().trim().min(1).optional(),
  interest: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  requested_discount: z.boolean().optional(),
})

export async function captureLead(
  args: z.infer<typeof captureLeadArgs>,
  ctx: ToolContext,
): Promise<{ leadId: string; status: 'captured' }> {
  if (!ctx.conversationId) throw new Error('capture_lead requiere conversationId')

  // Intentar enlazar el material de interés (best-effort).
  let materialId: string | null = null
  if (args.interest) {
    const [m] = await db
      .select({ id: materials.id })
      .from(materials)
      .where(ilike(materials.name, `%${args.interest.trim()}%`))
      .limit(1)
    materialId = m?.id ?? null
  }

  const [lead] = await db
    .insert(leads)
    .values({
      conversationId: ctx.conversationId,
      name: args.name ?? null,
      contact: args.contact ?? null,
      interest: args.interest ?? null,
      materialId,
      quantity: args.quantity != null ? String(args.quantity) : null,
      requestedDiscount: args.requested_discount ?? false,
    })
    .returning({ id: leads.id })

  await notifyAdmin(
    `Nuevo lead: ${args.name ?? 'sin nombre'} (${args.contact ?? 'sin contacto'}) — ` +
      `interés: ${args.interest ?? 'n/d'}${args.quantity ? `, cantidad: ${args.quantity}` : ''}` +
      `${args.requested_discount ? ' · pidió descuento' : ''}`,
  )

  return { leadId: lead.id, status: 'captured' }
}

// ─── request_human_handoff ────────────────────────────────────────────────────

const handoffArgs = z.object({ reason: z.string().trim().min(1) })

export async function requestHumanHandoff(
  args: z.infer<typeof handoffArgs>,
  ctx: ToolContext,
): Promise<{ status: 'human_controlled' }> {
  if (!ctx.conversationId) throw new Error('request_human_handoff requiere conversationId')

  await db
    .update(conversations)
    .set({ status: 'human_controlled' })
    .where(eq(conversations.id, ctx.conversationId))

  await notifyAdmin(`Relevo humano solicitado. Motivo: ${args.reason}`)

  return { status: 'human_controlled' }
}

// ─── get_location ─────────────────────────────────────────────────────────────

const getLocationArgs = z.object({}).optional()

export async function getLocation(): Promise<
  { found: true; context: string } | { found: false }
> {
  const chunks = await retrieve('ubicación dirección sede oficina dónde están ciudad', 3, 0.2)
  if (chunks.length === 0) return { found: false }
  return { found: true, context: chunks.map((c) => c.content).join('\n\n') }
}

// ─── log_knowledge_gap ────────────────────────────────────────────────────────

const logGapArgs = z.object({ question: z.string().trim().min(1) })

export async function logKnowledgeGap(
  args: z.infer<typeof logGapArgs>,
  ctx: ToolContext,
): Promise<{ logged: true; gapId: string }> {
  const [gap] = await db
    .insert(knowledgeGaps)
    .values({
      conversationId: ctx.conversationId ?? null,
      question: args.question,
    })
    .returning({ id: knowledgeGaps.id })
  return { logged: true, gapId: gap.id }
}

// ─── definiciones para function-calling ───────────────────────────────────────

export const toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_price',
      description:
        'Consulta el precio de un material/servicio en COP desde la tabla oficial. ' +
        'Úsalo SIEMPRE antes de dar cualquier precio; nunca inventes precios. ' +
        'Si pasas la cantidad, aplica precio mayorista cuando alcanza el umbral.',
      parameters: {
        type: 'object',
        properties: {
          material: { type: 'string', description: 'Nombre del material (ej. "Cobre #1")' },
          quantity: { type: 'number', description: 'Cantidad en la unidad del material (opcional)' },
        },
        required: ['material'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_lead',
      description:
        'Registra una solicitud/lead cuando el cliente muestra intención de compra/venta ' +
        'o pide cotización, y avisa al administrador. Captura los datos que tengas.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del cliente' },
          contact: { type: 'string', description: 'Teléfono o email' },
          interest: { type: 'string', description: 'Material o servicio de interés' },
          quantity: { type: 'number', description: 'Cantidad estimada' },
          requested_discount: { type: 'boolean', description: 'Si pidió un descuento' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_human_handoff',
      description:
        'Deriva la conversación a un agente humano (silencia al bot) cuando el cliente ' +
        'lo pide, hay queja/negociación compleja, o un descuento supera lo permitido.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo breve del relevo' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_location',
      description: 'Devuelve la(s) ubicación(es)/dirección(es) de la empresa desde el conocimiento.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_knowledge_gap',
      description:
        'Registra una pregunta que el conocimiento no pudo responder, para que el admin la ' +
        'resuelva luego. Úsalo cuando no haya contexto suficiente, antes de derivar.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'La pregunta sin responder, literal' },
        },
        required: ['question'],
        additionalProperties: false,
      },
    },
  },
]

// ─── despacho central ─────────────────────────────────────────────────────────

/** Ejecuta una tool por nombre. `rawArgs` es el JSON (string u objeto) del tool_call. */
export async function executeTool(
  name: string,
  rawArgs: string | object,
  ctx: ToolContext = {},
): Promise<unknown> {
  const parsed: unknown =
    typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs

  switch (name) {
    case 'lookup_price':
      return lookupPrice(lookupPriceArgs.parse(parsed))
    case 'capture_lead':
      return captureLead(captureLeadArgs.parse(parsed), ctx)
    case 'request_human_handoff':
      return requestHumanHandoff(handoffArgs.parse(parsed), ctx)
    case 'get_location':
      getLocationArgs.parse(parsed)
      return getLocation()
    case 'log_knowledge_gap':
      return logKnowledgeGap(logGapArgs.parse(parsed), ctx)
    default:
      throw new Error(`Tool desconocida: ${name}`)
  }
}
