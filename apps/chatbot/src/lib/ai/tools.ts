import type OpenAI from 'openai'
import { z } from 'zod'
import { and, cosineDistance, desc, eq, ilike, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig, conversations, images, knowledgeGaps, leads, materials } from '@/lib/db/schema'
import { notifyAdmin } from '@/lib/meta/notify'
import { env } from '@/lib/env'
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

/**
 * Modo de ejecución de las tools con efectos:
 *  - live: producción (webhook). Escribe y notifica al admin.
 *  - test: playground. Escribe pero marcado como prueba (lead.test), SIN notificar
 *    al admin ni cambiar conversaciones reales → ver el flujo como en producción.
 *  - eval: batería de regresión. No escribe nada (solo comprueba comportamiento).
 */
export type ToolMode = 'live' | 'test' | 'eval'

export interface ToolContext {
  /** Conversación actual; requerido por capture_lead, handoff y log_knowledge_gap. */
  conversationId?: string
  /** Modo de ejecución (default 'live'). */
  mode?: ToolMode
}

// Enlace directo a la conversación en el panel (para responder el relevo ahí mismo).
function panelConvLink(conversationId?: string | null): string {
  const base = (env.APP_URL ?? '').replace(/\/$/, '')
  if (!conversationId || !/^https?:\/\//.test(base)) return ''
  return `\nResponder en el panel: ${base}/conversations/${conversationId}`
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
  // La lista de materiales es curada y pequeña: traemos todo (con su medio fijo
  // vinculado, si tiene) y dejamos que resolveLookup haga el match por nombre Y
  // categoría (tolerante a frases/plurales/acentos).
  const rows = await db
    .select({
      name: materials.name,
      category: materials.category,
      active: materials.active,
      unit: materials.unit,
      retailPriceCop: materials.retailPriceCop,
      wholesalePriceCop: materials.wholesalePriceCop,
      wholesaleThreshold: materials.wholesaleThreshold,
      wholesalePrice2Cop: materials.wholesalePrice2Cop,
      wholesaleThreshold2: materials.wholesaleThreshold2,
      minOrder: materials.minOrder,
      mediaUrl: images.url,
      mediaType: images.type,
    })
    .from(materials)
    .leftJoin(images, eq(materials.imageId, images.id))
  return resolveLookup(
    rows.map((r) => ({ ...r, mediaType: r.mediaType === 'video' ? 'video' : r.mediaType ? 'image' : null })),
    args,
  )
}

// ─── list_materials ──────────────────────────────────────────────────────────

export interface ListedMaterial {
  name: string
  category: string | null
  unit: string
  retailPriceCop: number
  wholesalePriceCop: number | null
  wholesaleThreshold: number | null
}

// Lista los materiales/servicios cotizables (activos) con sus precios oficiales.
// Para responder "qué materiales manejas / de qué me das precio".
export async function listMaterials(): Promise<{ materials: ListedMaterial[] }> {
  const rows = await db.select().from(materials).where(eq(materials.active, true))
  return {
    materials: rows.map((m) => ({
      name: m.name,
      category: m.category,
      unit: m.unit,
      retailPriceCop: Number(m.retailPriceCop),
      wholesalePriceCop: m.wholesalePriceCop != null ? Number(m.wholesalePriceCop) : null,
      wholesaleThreshold: m.wholesaleThreshold != null ? Number(m.wholesaleThreshold) : null,
    })),
  }
}

// ─── capture_lead ─────────────────────────────────────────────────────────────

const captureLeadArgs = z.object({
  name: z.string().trim().min(1).optional(),
  contact: z.string().trim().min(1).optional(),
  interest: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().min(1).optional(),
  agreed_price: z.coerce.number().nonnegative().optional(),
  fulfillment: z.string().trim().min(1).optional(),
  scheduled_for: z.string().trim().min(1).optional(),
  payment_method: z.string().trim().min(1).optional(),
  requested_discount: z.boolean().optional(),
})

// Etapas automáticas del lead (won/lost las pone el humano y no se tocan aquí).
const STAGE_RANK: Record<string, number> = { new: 0, contacted: 1, quoted: 2, ready: 3 }

// Calcula la etapa según lo que ya se sabe; nunca retrocede ni pisa won/lost.
function leadStage(
  current: string,
  d: { contact: string | null; quantity: string | null; agreedPrice: string | null; logistics: boolean },
): string {
  if (current === 'won' || current === 'lost') return current
  const desired =
    d.agreedPrice != null && d.quantity != null && d.logistics
      ? 'ready'
      : d.agreedPrice != null
        ? 'quoted'
        : d.contact != null
          ? 'contacted'
          : 'new'
  return (STAGE_RANK[desired] ?? 0) > (STAGE_RANK[current] ?? 0) ? desired : current
}

/**
 * Captura/actualiza el lead de la conversación. ACUMULATIVO: una sola fila por
 * conversación que se va completando llamada a llamada (no duplica), para que el
 * bot pueda conducir la venta hasta dejarla "casi cerrada" (precio acordado +
 * cantidad + logística → status `ready`). El humano solo confirma pago y coordina.
 */
export async function captureLead(
  args: z.infer<typeof captureLeadArgs>,
  ctx: ToolContext,
): Promise<{ leadId: string; status: string }> {
  const mode = ctx.mode ?? 'live'
  if (mode === 'eval') return { leadId: 'dry-run', status: 'new' }
  const isTest = mode === 'test'

  // Material de interés (best-effort).
  let materialId: string | null = null
  if (args.interest) {
    const [m] = await db
      .select({ id: materials.id })
      .from(materials)
      .where(ilike(materials.name, `%${args.interest.trim()}%`))
      .limit(1)
    materialId = m?.id ?? null
  }

  // Lead existente de ESTA conversación (mismo flag de prueba) para acumular.
  const [existing] = ctx.conversationId
    ? await db
        .select()
        .from(leads)
        .where(and(eq(leads.conversationId, ctx.conversationId), eq(leads.test, isTest)))
        .orderBy(desc(leads.createdAt))
        .limit(1)
    : []

  // Mezcla: solo se sobrescribe lo que llega; lo demás conserva lo previo.
  const merged = {
    name: args.name ?? existing?.name ?? null,
    contact: args.contact ?? existing?.contact ?? null,
    interest: args.interest ?? existing?.interest ?? null,
    materialId: materialId ?? existing?.materialId ?? null,
    quantity: args.quantity != null ? String(args.quantity) : (existing?.quantity ?? null),
    unit: args.unit ?? existing?.unit ?? null,
    agreedPriceCop: args.agreed_price != null ? String(args.agreed_price) : (existing?.agreedPriceCop ?? null),
    fulfillment: args.fulfillment ?? existing?.fulfillment ?? null,
    scheduledFor: args.scheduled_for ?? existing?.scheduledFor ?? null,
    paymentMethod: args.payment_method ?? existing?.paymentMethod ?? null,
    requestedDiscount: args.requested_discount ?? existing?.requestedDiscount ?? false,
  }

  const status = leadStage(existing?.status ?? 'new', {
    contact: merged.contact,
    quantity: merged.quantity,
    agreedPrice: merged.agreedPriceCop,
    logistics: merged.fulfillment != null || merged.scheduledFor != null,
  })

  let leadId: string
  if (existing) {
    await db.update(leads).set({ ...merged, status }).where(eq(leads.id, existing.id))
    leadId = existing.id
  } else {
    const [row] = await db
      .insert(leads)
      .values({ conversationId: ctx.conversationId ?? null, ...merged, status, test: isTest })
      .returning({ id: leads.id })
    leadId = row.id
  }

  // Aviso al admin SOLO en producción y solo cuando aporta: al crear el lead, o al
  // quedar "casi cerrado" (ready). Así no se spamea en cada actualización parcial.
  const becameReady = status === 'ready' && existing?.status !== 'ready'
  if (mode === 'live' && (!existing || becameReady)) {
    const header = becameReady ? '🟢 Lead LISTO para cerrar' : 'Nuevo lead'
    const deal = [
      merged.interest ? `interés: ${merged.interest}` : null,
      merged.quantity ? `cantidad: ${merged.quantity}${merged.unit ? ' ' + merged.unit : ''}` : null,
      merged.agreedPriceCop ? `precio acordado: $${Number(merged.agreedPriceCop).toLocaleString('es-CO')}` : null,
      merged.fulfillment ? `logística: ${merged.fulfillment}` : null,
      merged.scheduledFor ? `cuándo: ${merged.scheduledFor}` : null,
      merged.paymentMethod ? `pago: ${merged.paymentMethod}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    await notifyAdmin(
      `${header}: ${merged.name ?? 'sin nombre'} (${merged.contact ?? 'sin contacto'})` +
        `${deal ? ' — ' + deal : ''}${merged.requestedDiscount ? ' · pidió descuento' : ''}` +
        panelConvLink(ctx.conversationId),
    )
  }

  return { leadId, status }
}

// ─── request_human_handoff ────────────────────────────────────────────────────

const handoffArgs = z.object({ reason: z.string().trim().min(1) })

export async function requestHumanHandoff(
  args: z.infer<typeof handoffArgs>,
  ctx: ToolContext,
): Promise<{ status: 'human_controlled' }> {
  const mode = ctx.mode ?? 'live'
  // En prueba/eval (o sin conversación real) se simula sin tocar nada.
  if (mode !== 'live' || !ctx.conversationId) return { status: 'human_controlled' }

  await db
    .update(conversations)
    .set({ status: 'human_controlled' })
    .where(eq(conversations.id, ctx.conversationId))

  await notifyAdmin(`Relevo humano solicitado. Motivo: ${args.reason}${panelConvLink(ctx.conversationId)}`)

  return { status: 'human_controlled' }
}

// ─── get_location ─────────────────────────────────────────────────────────────

const getLocationArgs = z.object({}).optional()

export interface LocationCard {
  latitude: number
  longitude: number
  name?: string
  address?: string
  mapsUrl?: string
}

export async function getLocation(): Promise<
  { found: true; context: string; location?: LocationCard } | { found: false }
> {
  const [cfg] = await db
    .select({
      name: botConfig.locationName,
      address: botConfig.locationAddress,
      lat: botConfig.locationLat,
      lng: botConfig.locationLng,
      mapsUrl: botConfig.locationMapsUrl,
    })
    .from(botConfig)
    .where(eq(botConfig.id, 1))

  const chunks = await retrieve('ubicación dirección sede oficina dónde están ciudad', 3, RAG_MIN_SCORE)
  const ragText = chunks.map((c) => c.content).join('\n\n')

  const hasCoords = cfg?.lat != null && cfg?.lng != null
  const location: LocationCard | undefined = hasCoords
    ? {
        latitude: Number(cfg!.lat),
        longitude: Number(cfg!.lng),
        name: cfg?.name ?? undefined,
        address: cfg?.address ?? undefined,
        mapsUrl: cfg?.mapsUrl ?? undefined,
      }
    : undefined

  // La dirección OFICIAL es la de Ajustes (la misma que la tarjeta/coordenadas): va
  // primero para que el bot la diga, y el contexto del RAG queda como complemento.
  const ctx = [cfg?.name, cfg?.address, ragText].filter(Boolean).join('\n')
  if (!ctx && !location) return { found: false }
  // Nota para el modelo: la tarjeta de ubicación (mapa + botón) se envía aparte.
  return { found: true, context: ctx || 'Se enviará la tarjeta de ubicación.', location }
}

// ─── find_media ───────────────────────────────────────────────────────────────

const findMediaArgs = z.object({ query: z.string().trim().min(1) })

// Umbral de similitud para adjuntar (evita medios irrelevantes). Coseno sobre
// nombre+descripción+etiquetas; 0.38 deja fuera coincidencias tangenciales.
const MEDIA_MIN_SCORE = 0.38

export type FindMediaResult =
  | { found: true; url: string; caption: string; type: 'image' | 'video'; similarity: number }
  | { found: false }

export async function findMedia(
  args: z.infer<typeof findMediaArgs>,
): Promise<FindMediaResult> {
  const queryEmbedding = await embed(args.query)
  const similarity = sql<number>`1 - (${cosineDistance(images.embedding, queryEmbedding)})`
  const [m] = await db
    .select({
      url: images.url,
      name: images.name,
      description: images.description,
      type: images.type,
      similarity,
    })
    .from(images)
    .orderBy(desc(similarity))
    .limit(1)

  if (!m || m.similarity < MEDIA_MIN_SCORE) return { found: false }
  return {
    found: true,
    url: m.url,
    caption: m.description?.trim() || m.name,
    type: m.type === 'video' ? 'video' : 'image',
    similarity: m.similarity,
  }
}

// ─── log_knowledge_gap ────────────────────────────────────────────────────────

const logGapArgs = z.object({ question: z.string().trim().min(1) })

export async function logKnowledgeGap(
  args: z.infer<typeof logGapArgs>,
  ctx: ToolContext,
): Promise<{ logged: true; gapId: string }> {
  const mode = ctx.mode ?? 'live'
  // En eval (regresión) no escribimos. En live y test (playground) SÍ: así, al
  // probar el bot, lo que no pudo responder queda visible en /gaps para resolverlo.
  if (mode === 'eval') return { logged: true, gapId: 'dry-run' }

  const question = args.question.trim()
  // Dedupe: si ya hay un hueco ABIERTO con la misma pregunta, no duplicar.
  const [existing] = await db
    .select({ id: knowledgeGaps.id })
    .from(knowledgeGaps)
    .where(
      and(
        eq(knowledgeGaps.status, 'open'),
        sql`lower(${knowledgeGaps.question}) = ${question.toLowerCase()}`,
      ),
    )
    .limit(1)
  if (existing) return { logged: true, gapId: existing.id }

  const [gap] = await db
    .insert(knowledgeGaps)
    .values({ conversationId: ctx.conversationId ?? null, question })
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
      name: 'list_materials',
      description:
        'Lista los materiales y servicios que la empresa cotiza, con sus precios oficiales en COP. ' +
        'Úsalo cuando el cliente pregunte EN GENERAL qué materiales compran/venden o de qué puedes dar ' +
        'precio. Los precios salen SIEMPRE de aquí (tabla oficial), nunca del conocimiento de documentos.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_lead',
      description:
        'Registra/ACTUALIZA el lead de la conversación cuando el cliente muestra intención ' +
        'de compra/venta o pide cotización. Es ACUMULATIVO: llámalo cada vez que confirmes un ' +
        'dato nuevo (contacto, cantidad, precio acordado, logística, fecha) y se irá completando ' +
        'el MISMO lead sin duplicar. Cuando tengas precio acordado + cantidad + logística, el lead ' +
        'queda "listo para cerrar" y se avisa al administrador.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del cliente' },
          contact: { type: 'string', description: 'Teléfono o email' },
          interest: { type: 'string', description: 'Material o servicio de interés' },
          quantity: { type: 'number', description: 'Cantidad concreta acordada' },
          unit: { type: 'string', description: 'Unidad de la cantidad (ej. kg, ton, unidad)' },
          agreed_price: {
            type: 'number',
            description:
              'Precio FINAL acordado en COP (unitario o total) tras aplicar el descuento permitido. ' +
              'Solo cuando el cliente lo acepte.',
          },
          fulfillment: {
            type: 'string',
            description:
              'Logística acordada: si el cliente lleva a la planta o si lo recogen (con dirección).',
          },
          scheduled_for: { type: 'string', description: 'Fecha/horario acordado para entrega o recogida' },
          payment_method: { type: 'string', description: 'Método de pago acordado (efectivo, transferencia, etc.)' },
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
      name: 'find_media',
      description:
        'Busca un medio ilustrativo (imagen o video corto) en el banco aprobado para adjuntarlo a la ' +
        'respuesta (p. ej. foto de un material, diagrama o clip de un proceso, una sede). Úsalo cuando ' +
        'un medio ayude a explicar. Solo adjunta lo que esta herramienta devuelva; NUNCA inventes URLs. ' +
        'Si devuelve found:false, no hay medio adecuado: responde solo con texto.',
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
    case 'list_materials':
      return listMaterials()
    case 'capture_lead':
      return captureLead(captureLeadArgs.parse(parsed), ctx)
    case 'request_human_handoff':
      return requestHumanHandoff(handoffArgs.parse(parsed), ctx)
    case 'get_location':
      getLocationArgs.parse(parsed)
      return getLocation()
    case 'find_media':
      return findMedia(findMediaArgs.parse(parsed))
    case 'log_knowledge_gap':
      return logKnowledgeGap(logGapArgs.parse(parsed), ctx)
    default:
      throw new Error(`Tool desconocida: ${name}`)
  }
}
