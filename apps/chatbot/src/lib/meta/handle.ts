import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig, conversations, customerProfiles, webhookEvents } from '@/lib/db/schema'
import { generateReply } from '@/lib/ai/generate'
import { appendMessage, countMessages, loadMemory } from '@/lib/ai/memory'
import { inngest } from '@/inngest/client'
import { notifyAdmin } from './notify'
import { env } from '@/lib/env'
import { logEvent } from '@/lib/log'
import { sendText, sendMedia, sendLocation } from './send'
import type { Channel, NormalizedEvent } from './normalize'

/** A partir de cuántos mensajes pedir un resumen de la conversación. */
const SUMMARIZE_AT = 12
/** Cada cuántos mensajes (tras cruzar el umbral) se vuelve a pedir resumen. */
const SUMMARIZE_EVERY = 5

// Respuesta fija para mensajes sin texto (foto/audio/video/ubicación/sticker) que el
// bot todavía no sabe procesar. Antes se ignoraban en silencio — el cliente se
// quedaba sin ninguna respuesta, indistinguible de "el bot no funciona". No pasa por
// el LLM: es más barato y 100% predecible que intentar "adivinar" sobre un adjunto.
const UNSUPPORTED_LABEL: Record<string, string> = {
  image: 'una imagen',
  video: 'un video',
  audio: 'un audio',
  location: 'una ubicación',
  file: 'un archivo',
}
const UNSUPPORTED_REPLY =
  'Por ahora no puedo ver fotos, audios ni ubicaciones directamente. Cuéntame en texto qué material es ' +
  'y qué cantidad tienes, y seguimos con la cotización.'

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

  // Lock por conversación (mismo patrón que capture_lead en tools.ts): si el
  // cliente manda dos mensajes casi seguidos, Meta puede entregarlos como dos
  // webhooks casi simultáneos → dos `handleEvent` en paralelo, cada uno leyendo
  // la memoria en un punto distinto y generando/enviando una respuesta propia
  // (visto en prod: el bot respondía dos veces distinto a la misma pregunta).
  // El lock serializa todo el pipeline por (canal, externalId): el segundo
  // evento espera a que el primero termine de responder antes de arrancar.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${e.channel}:${e.externalId}`}))`)
    await processEvent(e)
  })
}

async function processEvent(e: NormalizedEvent): Promise<void> {
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

  // 2b) Mensaje sin texto que aún no sabemos procesar: se guarda (queda visible en
  //     el panel) y se responde el aviso fijo, sin pasar por el LLM.
  if (e.kind === 'unsupported') {
    const label = UNSUPPORTED_LABEL[e.unsupportedType ?? 'file'] ?? 'un archivo'
    await appendMessage(mem.conversationId, 'user', `[el cliente envió ${label}]`, e.messageId)
    if (mem.status !== 'human_controlled' && (await channelEnabled(e.channel))) {
      await sendText(e.channel, e.externalId, UNSUPPORTED_REPLY)
      await appendMessage(mem.conversationId, 'assistant', UNSUPPORTED_REPLY, undefined, { tools: [] })
    }
    return
  }

  // 3) Guardar el mensaje entrante del cliente.
  await appendMessage(mem.conversationId, 'user', e.text, e.messageId)

  // 4) Si un humano lleva el hilo, el bot no responde.
  if (mem.status === 'human_controlled') return

  // 4b) Si el canal está desactivado en Ajustes, no responder (queda registrado).
  if (!(await channelEnabled(e.channel))) return

  // 5-6) Generar (RAG + router + tools) y enviar. Si falla (OpenAI/Send API tras los
  //   reintentos), NO debe quedar silencioso: el mensaje entrante ya está guardado
  //   (paso 3, visible en el panel) y se avisa al admin para que un humano responda.
  try {
    const res = await generateReply({
      message: e.text,
      history: mem.history,
      conversationId: mem.conversationId,
      customerSummary: mem.customerSummary,
      conversationSummary: mem.summary,
    })

    // Enviar PRIMERO y persistir después: así no queda registrado como enviado un
    // mensaje que el envío no logró entregar.
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

    // Medios ilustrativos (imagen/video) que acompañan la respuesta. Si falla, no
    // rompemos la conversación (el texto ya se entregó) pero SÍ queda en el Panel
    // de salud — antes se tragaba en silencio y nadie se enteraba de que la foto
    // nunca le llegó al cliente.
    for (const att of res.attachments) {
      try {
        await sendMedia(e.channel, e.externalId, att)
      } catch (err) {
        await logEvent('warning', 'send-media', err instanceof Error ? err.message : String(err), {
          conversationId: mem.conversationId,
          channel: e.channel,
        })
      }
    }

    // Tarjeta de ubicación (mapa) cuando el bot usó get_location y hay sede.
    if (res.location) {
      try {
        await sendLocation(e.channel, e.externalId, res.location)
      } catch (err) {
        // si falla la tarjeta, el texto ya llevó la dirección: no rompemos nada,
        // pero igual queda registrado para poder darle seguimiento.
        await logEvent('warning', 'send-location', err instanceof Error ? err.message : String(err), {
          conversationId: mem.conversationId,
          channel: e.channel,
        })
      }
    }
  } catch (err) {
    // Degradación elegante: avisar al admin (no quedarse callado) y dejarlo en el
    // Panel de salud CON el conversationId (antes el log de route.ts no lo traía,
    // así que no había forma de saber a qué cliente afectó un error sin ir a
    // revisar uno por uno). No relanzamos: ya quedó tanto notificado como logueado
    // aquí mismo; el catch de route.ts sigue como red de seguridad para errores
    // que no pasen por este pipeline (ej. fallos antes de tener `mem`).
    const message = err instanceof Error ? err.message : String(err)
    const base = (env.APP_URL ?? '').replace(/\/$/, '')
    const link = /^https?:\/\//.test(base) ? `\n${base}/conversations/${mem.conversationId}` : ''
    await notifyAdmin(
      `⚠️ El bot no pudo responder a un cliente (${e.channel}). El mensaje quedó guardado; ` +
        `respóndele desde el panel.${link}`,
    )
    await logEvent('error', 'bot-reply-failed', message, { conversationId: mem.conversationId, channel: e.channel })
    return
  }

  // 7) Resumen periódico para acotar tokens en conversaciones largas. Se dispara
  //    una vez al cruzar el umbral y luego cada SUMMARIZE_EVERY mensajes (no en
  //    cada mensaje: el job ya es incremental, pero no hace falta invocarlo tanto).
  const count = await countMessages(mem.conversationId)
  if (count > SUMMARIZE_AT && (count - SUMMARIZE_AT - 1) % SUMMARIZE_EVERY === 0) {
    await inngest.send({
      name: 'memory/conversation.summarize',
      data: { conversationId: mem.conversationId },
    })
  }
}
