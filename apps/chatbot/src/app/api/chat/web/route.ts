import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig, messages } from '@/lib/db/schema'
import { generateReply } from '@/lib/ai/generate'
import { appendMessage, countMessages, loadMemory } from '@/lib/ai/memory'
import { inngest } from '@/inngest/client'
import { logEvent } from '@/lib/log'
import { env } from '@/lib/env'

interface ChatResult {
  status: number
  body: unknown
}

/**
 * Chat web público (burbuja del sitio corporativo). Blueprint §8: mismo cerebro
 * que los canales Meta, canal `web`. Reutiliza el pipeline de `handleEvent`
 * (memoria → generateReply → persistencia) pero devuelve la respuesta en el
 * cuerpo HTTP en vez de enviarla por la Send API de Meta.
 *
 * - Público (fuera de `/api/panel/*` → el proxy Clerk lo deja pasar).
 * - `mode: 'live'` → captura leads reales en el panel y notifica al admin
 *   (igual que WhatsApp), asociados a una conversación con `channel = 'web'`.
 * - Sesión anónima: el cliente genera un `sessionId` (UUID en localStorage) que
 *   actúa como `external_id`. Sin login.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

const SUMMARIZE_AT = 12
const SUMMARIZE_EVERY = 5

// Orígenes permitidos para CORS. Configurable con WEB_CHAT_ALLOWED_ORIGINS
// (coma-separado); por defecto, el dominio del sitio + dev local de Astro.
const ALLOWED_ORIGINS = (
  env.WEB_CHAT_ALLOWED_ORIGINS ??
  'https://ci-quality-group.com,https://www.ci-quality-group.com,http://localhost:4321'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

// Anti-abuso ligero por sesión: máx. de mensajes del usuario en una ventana.
// El límite por sesión NO es una barrera real por sí solo (el sessionId lo
// genera el cliente; basta con crear uno nuevo para resetear el contador) — por
// eso se complementa con un límite en memoria por IP (ipRateLimit, abajo). Ojo:
// ese límite en memoria es por INSTANCIA de servidor (se reinicia en cold start,
// no se comparte entre instancias) — ES UN COMPLEMENTO, no un reemplazo de un
// rate-limit real a nivel de plataforma (Vercel Firewall), que sigue pendiente
// de configurar en el dashboard (no es algo que se declare en vercel.json).
const RATE_WINDOW_MS = 15_000
const RATE_MAX_IN_WINDOW = 5

// Límite adicional por IP, en memoria del proceso (ver nota arriba: es un
// complemento al de sesión, no un rate-limit real de plataforma). Ventana más
// amplia porque agrupa TODAS las sesiones que vengan de la misma IP — pensado
// para frenar un script que rota sessionId en cada mensaje.
const IP_RATE_WINDOW_MS = 60_000
const IP_RATE_MAX_IN_WINDOW = 20
const ipHits = new Map<string, number[]>()

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function ipRateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_RATE_WINDOW_MS)
  hits.push(now)
  ipHits.set(ip, hits)
  // Poda ocasional para no acumular memoria indefinidamente en una instancia longeva.
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.every((t) => now - t >= IP_RATE_WINDOW_MS)) ipHits.delete(k)
    }
  }
  return hits.length > IP_RATE_MAX_IN_WINDOW
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const bodySchema = z.object({
  // UUID anónimo generado por el cliente (localStorage). external_id del canal web.
  sessionId: z.string().trim().min(8).max(100),
  message: z.string().trim().min(1).max(2000),
})

// Preflight CORS.
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

// Saludo inicial de la burbuja (antes de que el cliente escriba nada). Devuelve
// el mensaje de bienvenida configurado en Ajustes tal cual, en vivo desde la
// BD — así el widget nunca queda con un saludo desactualizado/hardcodeado.
export async function GET(req: Request) {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)
  if (!cors['Access-Control-Allow-Origin']) {
    return NextResponse.json(
      { success: false, error: { code: 'ORIGIN', message: 'Origin no permitido.' } },
      { status: 403 },
    )
  }

  const [cfg] = await db
    .select({ botName: botConfig.botName, welcomeMessage: botConfig.welcomeMessage })
    .from(botConfig)
    .where(eq(botConfig.id, 1))

  return NextResponse.json(
    {
      success: true,
      data: {
        botName: cfg?.botName?.trim() || 'Asistente de CI Quality Group',
        welcomeMessage: cfg?.welcomeMessage?.trim() || '',
      },
    },
    { headers: cors },
  )
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)

  // Bloquear orígenes no permitidos (evita que otros sitios usen el bot y gasten tokens).
  if (!cors['Access-Control-Allow-Origin']) {
    return NextResponse.json(
      { success: false, error: { code: 'ORIGIN', message: 'Origin no permitido.' } },
      { status: 403 },
    )
  }

  if (ipRateLimited(clientIp(req))) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Vas muy rápido, espera un momento.' } },
      { status: 429, headers: cors },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Escribe un mensaje.' } },
      { status: 400, headers: cors },
    )
  }
  const { sessionId, message } = parsed.data

  try {
    // Lock por sesión (mismo patrón que el webhook de Meta, handle.ts): si el
    // navegador manda dos mensajes casi seguidos (doble clic, reintento del
    // cliente), esto serializa el pipeline por sessionId en vez de dejar correr
    // dos generaciones en paralelo que lean la memoria en puntos distintos.
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`web:${sessionId}`}))`)
      return runChat(sessionId, message)
    })
    return NextResponse.json(result.body, { status: result.status, headers: cors })
  } catch (e) {
    await logEvent('error', 'chat/web', e instanceof Error ? e.message : String(e))
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE', message: 'No se pudo responder. Reintenta.' } },
      { status: 500, headers: cors },
    )
  }
}

async function runChat(sessionId: string, message: string): Promise<ChatResult> {
  // 1) Memoria: upsert de conversación con channel='web' + perfil + historial.
  const mem = await loadMemory('web', sessionId)

  // 2) Anti-abuso por sesión: ¿demasiados mensajes en la ventana?
  const since = new Date(Date.now() - RATE_WINDOW_MS)
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(eq(messages.conversationId, mem.conversationId), eq(messages.role, 'user'), gt(messages.createdAt, since)),
    )
  if (n >= RATE_MAX_IN_WINDOW) {
    return {
      status: 429,
      body: { success: false, error: { code: 'RATE_LIMIT', message: 'Vas muy rápido, espera un momento.' } },
    }
  }

  // 3) Guardar el mensaje entrante.
  await appendMessage(mem.conversationId, 'user', message)

  // 4) Si un humano tomó el hilo desde el panel, el bot no responde.
  if (mem.status === 'human_controlled') {
    return {
      status: 200,
      body: {
        success: true,
        data: {
          reply: 'Un asesor está atendiendo tu conversación y te responderá en breve por este chat.',
          handoff: true,
          attachments: [],
        },
      },
    }
  }

  // 5) Generar (RAG + router + tools). mode:'live' → leads reales + notifica al admin.
  const res = await generateReply({
    message,
    history: mem.history,
    conversationId: mem.conversationId,
    customerSummary: mem.customerSummary,
    conversationSummary: mem.summary,
    mode: 'live',
  })

  // 6) Persistir la respuesta del bot con metadata (igual que el canal Meta).
  if (res.reply.trim()) {
    await appendMessage(mem.conversationId, 'assistant', res.reply, undefined, {
      model: res.model,
      routerReason: res.routerReason,
      contextUsed: res.contextUsed,
      topScores: res.retrieved.slice(0, 3).map((r) => Number(r.similarity.toFixed(3))),
      tools: res.toolCalls.map((t) => t.name),
    })
  }

  // 7) Resumen periódico en segundo plano (no retrasa la respuesta). Una vez al
  //    cruzar el umbral y luego cada SUMMARIZE_EVERY mensajes (el job ya es
  //    incremental, pero no hace falta invocarlo en cada mensaje).
  after(async () => {
    try {
      const count = await countMessages(mem.conversationId)
      if (count > SUMMARIZE_AT && (count - SUMMARIZE_AT - 1) % SUMMARIZE_EVERY === 0) {
        await inngest.send({
          name: 'memory/conversation.summarize',
          data: { conversationId: mem.conversationId },
        })
      }
    } catch {
      // best-effort: el resumen es secundario
    }
  })

  return {
    status: 200,
    body: {
      success: true,
      data: {
        reply: res.reply,
        handoff: res.toolCalls.some((t) => t.name === 'request_human_handoff'),
        attachments: res.attachments,
        location: res.location ?? null,
      },
    },
  }
}
