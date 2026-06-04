import type OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { openai } from './openai'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'
import { retrieve } from './retrieve'
import { buildSystemPrompt } from './system-prompt'
import { selectModel } from './router'
import { executeTool, toolDefinitions, type ToolContext } from './tools'

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
}

export interface ExecutedTool {
  name: string
  args: unknown
  result: unknown
}

export interface GenerateResult {
  reply: string
  model: string
  routerReason: string
  contextUsed: boolean
  toolCalls: ExecutedTool[]
}

const TEMPERATURE = 0.3
const MAX_TOOL_ROUNDS = 5
const RAG_K = 5
const RAG_MIN_SCORE = 0.2

const safeParse = (s: string): unknown => {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return s
  }
}

export async function generateReply(input: GenerateInput): Promise<GenerateResult> {
  // 1) RAG: recuperar contexto para el mensaje actual.
  const chunks = await retrieve(input.message, RAG_K, RAG_MIN_SCORE)
  const contextUsed = chunks.length > 0
  const context = chunks.map((c) => c.content).join('\n\n---\n\n')

  // 2) Router: elegir modelo.
  const { model, reason } = selectModel({
    message: input.message,
    contextFound: contextUsed,
    topSimilarity: chunks[0]?.similarity,
  })

  // 3) System prompt con identidad/tono (bot_config) + memoria + contexto.
  const [cfg] = await db.select().from(botConfig).where(eq(botConfig.id, 1))
  const system = buildSystemPrompt({
    botName: cfg?.botName ?? 'Asistente de CI Quality Group',
    tonePrompt: cfg?.tonePrompt ?? '',
    maxAutoDiscountPct: Number(cfg?.maxAutoDiscountPct ?? 0),
    context,
    customerSummary: input.customerSummary ?? null,
  })

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...(input.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message },
  ]

  const ctx: ToolContext = { conversationId: input.conversationId }
  const executed: ExecutedTool[] = []

  // 4) Bucle de tool-calling.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model,
      temperature: TEMPERATURE,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    })

    const msg = completion.choices[0].message
    messages.push(msg)

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      return { reply: msg.content ?? '', model, routerReason: reason, contextUsed, toolCalls: executed }
    }

    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      let result: unknown
      try {
        result = await executeTool(call.function.name, call.function.arguments, ctx)
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) }
      }
      executed.push({ name: call.function.name, args: safeParse(call.function.arguments), result })
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }
  }

  // 5) Se agotaron las rondas: última llamada sin tools para forzar texto.
  const final = await openai.chat.completions.create({ model, temperature: TEMPERATURE, messages })
  return {
    reply: final.choices[0].message.content ?? '',
    model,
    routerReason: reason,
    contextUsed,
    toolCalls: executed,
  }
}
