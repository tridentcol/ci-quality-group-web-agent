import type OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { openai } from './openai'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'
import { retrieve } from './retrieve'
import { buildSystemPrompt } from './system-prompt'
import { selectModel } from './router'
import { executeTool, toolDefinitions, MEDIA_MIN_SCORE, type ToolContext, type ToolMode, type LocationCard } from './tools'
import { RAG_K, RAG_MIN_SCORE } from './rag-config'
import { isAfterHours } from './hours'

/**
 * Motor de generación (blueprint §9 Step 9): arma el system prompt (tono +
 * memoria + RAG), elige modelo con el router, llama a OpenAI con tool-calling
 * y ejecuta las tools en bucle hasta obtener la respuesta final.
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export interface GenerateInput {
  /** Mensaje actual del cliente. */
  message: string
  /** Historial reciente (memoria de corto plazo), del más antiguo al más nuevo. */
  history?: ChatTurn[]
  /** Conversación actual; lo necesitan capture_lead/handoff/log_knowledge_gap. */
  conversationId?: string
  /** Resumen de memoria de largo plazo del cliente, si existe. */
  customerSummary?: string | null
  /** Resumen acumulado de la conversación larga (conversations.summary), si existe. */
  conversationSummary?: string | null
  /** Modo de ejecución de las tools: 'live' (default) | 'test' (playground) | 'eval'. */
  mode?: ToolMode
}

export interface ExecutedTool {
  name: string
  args: unknown
  result: unknown
}

export interface RetrievedChunkPreview {
  content: string
  similarity: number
}

export interface GenerateResult {
  reply: string
  model: string
  routerReason: string
  contextUsed: boolean
  toolCalls: ExecutedTool[]
  /** Chunks recuperados por RAG (para depurar cobertura en el playground). */
  retrieved: RetrievedChunkPreview[]
  /** Medios (imagen/video) a adjuntar: material-vinculado, Q&A-vinculado o semántico. */
  attachments: MediaAttachment[]
  /** Tarjeta de ubicación a enviar (si el bot usó get_location y hay sede configurada). */
  location?: LocationCard
}

export interface MediaAttachment {
  url: string
  caption: string
  type: 'image' | 'video'
}

const TEMPERATURE = 0.3
const MAX_TOOL_ROUNDS = 5
const MAX_ATTACHMENTS = 2 // tope de medios por respuesta (evita spam)

const safeParse = (s: string): unknown => {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return s
  }
}

export interface AssembledGeneration {
  system: string
  model: string
  routerReason: string
  contextUsed: boolean
  retrieved: RetrievedChunkPreview[]
  /** Medios vinculados a las FAQ recuperadas (adjunto determinista por Q&A). */
  linkedMedia: MediaAttachment[]
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  /** Afinación efectiva (config o defaults) que usa el turno. */
  temperature: number
  maxAttachments: number
  mediaMinScore: number
}

/**
 * Arma todo lo previo a llamar al modelo: RAG (contexto) → router (modelo) →
 * system prompt (tono + memoria + contexto + bienvenida/horario) → mensajes.
 * Lo comparten `generateReply` y el visor de prompt del panel para que lo que se
 * muestra sea EXACTAMENTE lo que usa el bot (sin desincronización).
 */
export async function assembleGeneration(input: GenerateInput): Promise<AssembledGeneration> {
  // 0) Config del bot (incluye AFINACIÓN). Se carga primero porque afina el RAG.
  //    NULL en una columna = usar el valor por defecto del código.
  const [cfg] = await db.select().from(botConfig).where(eq(botConfig.id, 1))
  const ragK = cfg?.ragK ?? RAG_K
  const ragMinScore = cfg?.ragMinScore != null ? Number(cfg.ragMinScore) : RAG_MIN_SCORE
  const temperature = cfg?.temperature != null ? Number(cfg.temperature) : TEMPERATURE
  const maxAttachments = cfg?.maxAttachments ?? MAX_ATTACHMENTS
  const mediaMinScore = cfg?.mediaMinScore != null ? Number(cfg.mediaMinScore) : MEDIA_MIN_SCORE

  // 1) RAG: recuperar contexto para el mensaje actual (con la afinación configurada).
  const chunks = await retrieve(input.message, ragK, ragMinScore)
  const contextUsed = chunks.length > 0
  const context = chunks.map((c) => c.content).join('\n\n---\n\n')
  const retrieved: RetrievedChunkPreview[] = chunks.map((c) => ({
    content: c.content,
    similarity: c.similarity,
  }))

  // Medios vinculados a las FAQ recuperadas (adjunto determinista por Q&A).
  const linkedMedia: MediaAttachment[] = []
  for (const c of chunks) {
    const meta = (c.metadata ?? {}) as { mediaUrl?: string | null; mediaType?: 'image' | 'video' | null }
    if (meta.mediaUrl && !linkedMedia.some((m) => m.url === meta.mediaUrl)) {
      linkedMedia.push({ url: meta.mediaUrl, caption: '', type: meta.mediaType ?? 'image' })
    }
  }

  // 2) Router: elegir modelo.
  const { model, reason } = selectModel({
    message: input.message,
    contextFound: contextUsed,
    topSimilarity: chunks[0]?.similarity,
  })

  // 3) System prompt con identidad/tono (bot_config) + memoria + contexto +
  //    bienvenida (en el primer mensaje) y aviso fuera de horario.
  const isFirstMessage = !(input.history && input.history.length > 0)
  const afterHours = isAfterHours(cfg?.businessHours ?? null)
  const system = buildSystemPrompt({
    botName: cfg?.botName ?? 'Asistente de CI Quality Group',
    tonePrompt: cfg?.tonePrompt ?? '',
    maxAutoDiscountPct: Number(cfg?.maxAutoDiscountPct ?? 0),
    context,
    customerSummary: input.customerSummary ?? null,
    welcomeMessage: cfg?.welcomeMessage ?? null,
    afterHoursMessage: cfg?.afterHoursMessage ?? null,
    isFirstMessage,
    afterHours,
    extraInstructions: cfg?.extraInstructions ?? null,
  })

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...(input.conversationSummary?.trim()
      ? [
          {
            role: 'system' as const,
            content: `Resumen de lo conversado antes:\n${input.conversationSummary.trim()}`,
          },
        ]
      : []),
    ...(input.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message },
  ]

  return {
    system,
    model,
    routerReason: reason,
    contextUsed,
    retrieved,
    linkedMedia,
    messages,
    temperature,
    maxAttachments,
    mediaMinScore,
  }
}

export async function generateReply(input: GenerateInput): Promise<GenerateResult> {
  const { model, routerReason: reason, contextUsed, retrieved, linkedMedia, messages, temperature, maxAttachments, mediaMinScore } =
    await assembleGeneration(input)

  const ctx: ToolContext = {
    conversationId: input.conversationId,
    mode: input.mode ?? 'live',
    mediaMinScore,
  }
  const executed: ExecutedTool[] = []

  // Adjuntos por fuente, con prioridad: material-vinculado (lookup_price) →
  // Q&A-vinculado (retrieve) → semántico (find_media). Al final se dedupe y se
  // toman los MAX_ATTACHMENTS primeros por prioridad.
  const materialMedia: MediaAttachment[] = []
  const semanticMedia: MediaAttachment[] = []
  let locationCard: LocationCard | undefined
  const finalAttachments = (): MediaAttachment[] => {
    const out: MediaAttachment[] = []
    for (const a of [...materialMedia, ...linkedMedia, ...semanticMedia]) {
      if (a.url && !out.some((x) => x.url === a.url) && out.length < maxAttachments) out.push(a)
    }
    return out
  }

  // Recolecta medios deterministas (material) y semánticos (find_media).
  const collectAttachment = (name: string, result: unknown) => {
    if (!result || typeof result !== 'object') return
    if (name === 'find_media') {
      const r = result as { found?: boolean; url?: string; caption?: string; type?: 'image' | 'video' }
      if (r.found && r.url) semanticMedia.push({ url: r.url, caption: r.caption ?? '', type: r.type ?? 'image' })
    } else if (name === 'lookup_price') {
      const r = result as { available?: boolean; mediaUrl?: string | null; mediaType?: 'image' | 'video' | null; material?: string }
      if (r.available && r.mediaUrl) materialMedia.push({ url: r.mediaUrl, caption: r.material ?? '', type: r.mediaType ?? 'image' })
    } else if (name === 'get_location') {
      const r = result as { found?: boolean; location?: LocationCard }
      if (r.found && r.location) locationCard = r.location
    }
  }

  // 4) Bucle de tool-calling.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model,
      temperature,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    })

    const msg = completion.choices[0]?.message
    if (!msg) throw new Error('OpenAI no devolvió ninguna opción de respuesta.')
    messages.push(msg)

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      return {
        reply: msg.content ?? '',
        model,
        routerReason: reason,
        contextUsed,
        toolCalls: executed,
        retrieved,
        attachments: finalAttachments(),
        location: locationCard,
      }
    }

    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      let result: unknown
      try {
        result = await executeTool(call.function.name, call.function.arguments, ctx)
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) }
      }
      collectAttachment(call.function.name, result)
      executed.push({ name: call.function.name, args: safeParse(call.function.arguments), result })
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }
  }

  // 5) Se agotaron las rondas: última llamada sin tools para forzar texto.
  const final = await openai.chat.completions.create({ model, temperature, messages })
  return {
    reply: final.choices[0]?.message?.content ?? '',
    model,
    routerReason: reason,
    contextUsed,
    toolCalls: executed,
    retrieved,
    attachments: finalAttachments(),
    location: locationCard,
  }
}
