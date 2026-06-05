import type OpenAI from 'openai'
import { z } from 'zod'
import { cosineDistance, desc, eq, ilike, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, images, knowledgeGaps, leads, materials } from '@/lib/db/schema'
import { notifyAdmin } from '@/lib/meta/notify'
import { embed } from './embed'
import { retrieve } from './retrieve'
import { RAG_MIN_SCORE } from './rag-config'
import { resolveLookup, type LookupPriceResult } from './pricing'

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
  /** Modo prueba (playground/eval): las tools con efectos NO escriben en BD. */
  dryRun?: boolean
}

// ─── lookup_price ────────────────────────────────────────────────────────────

const lookupPriceArgs = z.object({
  material: z.string().trim().min(1),
  quantity: z.coerce.number().positive().optional(),
})

export type { LookupPriceResult }

export async function lookupPrice(
  args: z.infer<typeof lookupPriceArgs>,
): Promise<LookupPriceResult> {
  // La lista de materiales es curada y pequeña: traemos todo y dejamos que
  // resolveLookup haga el match por nombre Y categoría (tolerante a frases como
  // "láminas tipo kingspan" y a plurales/acentos). Filtrar con ILIKE por nombre
  // fallaba cuando el cliente describe el material con otras palabras.
  const rows = await db.select().from(materials)
  return resolveLookup(rows, args)
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
  if (ctx.dryRun) return { leadId: 'dry-run', status: 'captured' }
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
  if (ctx.dryRun) return { status: 'human_controlled' }
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
  const chunks = await retrieve('ubicación dirección sede oficina dónde están ciudad', 3, RAG_MIN_SCORE)
  if (chunks.length === 0) return { found: false }
  return { found: true, context: chunks.map((c) => c.content).join('\n\n') }
}

// ─── find_image ───────────────────────────────────────────────────────────────

const findImageArgs = z.object({ query: z.string().trim().min(1) })

// Umbral de similitud para adjuntar (evita imágenes irrelevantes). Coseno sobre
// nombre+descripción+etiquetas; 0.38 deja fuera coincidencias tangenciales.
const IMAGE_MIN_SCORE = 0.38

export type FindImageResult =
  | { found: true; url: string; caption: string; similarity: number }
  | { found: false }

export async function findImage(
  args: z.infer<typeof findImageArgs>,
): Promise<FindImageResult> {
  const queryEmbedding = await embed(args.query)
  const similarity = sql<number>`1 - (${cosineDistance(images.embedding, queryEmbedding)})`
  const [img] = await db
    .select({
      url: images.url,
      name: images.name,
      description: images.description,
      similarity,
    })
    .from(images)
    .orderBy(desc(similarity))
    .limit(1)

  if (!img || img.similarity < IMAGE_MIN_SCORE) return { found: false }
  return {
    found: true,
    url: img.url,
    caption: img.description?.trim() || img.name,
    similarity: img.similarity,
  }
}

// ─── log_knowledge_gap ────────────────────────────────────────────────────────

const logGapArgs = z.object({ question: z.string().trim().min(1) })

export async function logKnowledgeGap(
  args: z.infer<typeof logGapArgs>,
  ctx: ToolContext,
): Promise<{ logged: true; gapId: string }> {
  if (ctx.dryRun) return { logged: true, gapId: 'dry-run' }
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
      name: 'find_image',
      description:
        'Busca una imagen ilustrativa en el banco de imágenes aprobado para adjuntarla a la ' +
        'respuesta (p. ej. foto de un material, diagrama de un proceso, una sede). Úsala cuando una ' +
        'imagen ayude a explicar. Solo adjunta lo que esta herramienta devuelva; NUNCA inventes URLs. ' +
        'Si devuelve found:false, no hay imagen adecuada: responde solo con texto.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Qué ilustrar (ej. "cobre #1", "proceso de chatarrización")' },
        },
        required: ['query'],
        additionalProperties: false,
      },
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
    case 'find_image':
      return findImage(findImageArgs.parse(parsed))
    case 'log_knowledge_gap':
      return logKnowledgeGap(logGapArgs.parse(parsed), ctx)
    default:
      throw new Error(`Tool desconocida: ${name}`)
  }
}
