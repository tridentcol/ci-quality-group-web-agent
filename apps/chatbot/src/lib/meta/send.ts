import { env } from '@/lib/env'
import type { Channel } from './normalize'

/**
 * Envío por canal (Send API de Meta) — blueprint §9 Step 10.
 * Texto, quick replies (Messenger/Instagram) y tarjeta de ubicación.
 * Lanza si el canal no tiene credenciales; el webhook captura y loguea.
 */

// Versión del Graph API fijada por env (default a una estable reciente).
const GRAPH = `https://graph.facebook.com/${env.GRAPH_API_VERSION || 'v23.0'}`

// Límite de longitud de texto por mensaje según canal (con margen).
const TEXT_LIMIT: Record<Channel, number> = { messenger: 1900, instagram: 1900, whatsapp: 4000 }

export interface SendOptions {
  /** Respuestas rápidas (solo Messenger/Instagram). */
  quickReplies?: string[]
}

/** Parte un texto largo en trozos ≤limit, cortando por párrafo/frase/espacio. */
export function splitMessage(text: string, limit: number): string[] {
  const t = text.trim()
  if (t.length <= limit) return [t]
  const chunks: string[] = []
  let rest = t
  while (rest.length > limit) {
    const slice = rest.slice(0, limit)
    // mejor punto de corte: doble salto > salto > final de frase > espacio
    const cut =
      Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n')) ||
      Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '))
    const at = cut > limit * 0.5 ? cut : limit
    chunks.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export interface Location {
  latitude: number
  longitude: number
  name?: string
  address?: string
}

async function post(url: string, token: string, payload: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Meta Send API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json().catch(() => ({}))
}

function pageMessage(to: string, text: string, opts?: SendOptions) {
  const message: Record<string, unknown> = { text }
  if (opts?.quickReplies?.length) {
    message.quick_replies = opts.quickReplies.slice(0, 13).map((t) => ({
      content_type: 'text',
      title: t.slice(0, 20),
      payload: t.slice(0, 1000),
    }))
  }
  return { recipient: { id: to }, messaging_type: 'RESPONSE', message }
}

// Envía un texto, dividiéndolo en varios mensajes si supera el límite del canal.
// Las quick replies se adjuntan solo al ÚLTIMO mensaje.
export async function sendText(
  channel: Channel,
  to: string,
  text: string,
  opts?: SendOptions,
): Promise<unknown> {
  const parts = splitMessage(text, TEXT_LIMIT[channel])
  let last: unknown
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1
    last = await sendTextChunk(channel, to, parts[i], isLast ? opts : undefined)
  }
  return last
}

async function sendTextChunk(
  channel: Channel,
  to: string,
  text: string,
  opts?: SendOptions,
): Promise<unknown> {
  switch (channel) {
    case 'whatsapp': {
      if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN)
        throw new Error('WhatsApp no configurado (WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN)')
      return post(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, env.WHATSAPP_ACCESS_TOKEN, {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      })
    }
    case 'messenger': {
      if (!env.MESSENGER_PAGE_ID || !env.MESSENGER_PAGE_ACCESS_TOKEN)
        throw new Error('Messenger no configurado (MESSENGER_PAGE_ID/ACCESS_TOKEN)')
      return post(
        `${GRAPH}/${env.MESSENGER_PAGE_ID}/messages`,
        env.MESSENGER_PAGE_ACCESS_TOKEN,
        pageMessage(to, text, opts),
      )
    }
    case 'instagram': {
      if (!env.IG_ACCOUNT_ID || !env.INSTAGRAM_ACCESS_TOKEN)
        throw new Error('Instagram no configurado (IG_ACCOUNT_ID/INSTAGRAM_ACCESS_TOKEN)')
      return post(
        `${GRAPH}/${env.IG_ACCOUNT_ID}/messages`,
        env.INSTAGRAM_ACCESS_TOKEN,
        pageMessage(to, text, opts),
      )
    }
  }
}

/** Envía una imagen por URL pública (con pie opcional). Meta descarga la URL. */
export async function sendImage(
  channel: Channel,
  to: string,
  url: string,
  caption?: string,
): Promise<unknown> {
  switch (channel) {
    case 'whatsapp': {
      if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN)
        throw new Error('WhatsApp no configurado')
      return post(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, env.WHATSAPP_ACCESS_TOKEN, {
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: { link: url, caption: caption || undefined },
      })
    }
    case 'messenger':
    case 'instagram': {
      const id = channel === 'messenger' ? env.MESSENGER_PAGE_ID : env.IG_ACCOUNT_ID
      const token =
        channel === 'messenger' ? env.MESSENGER_PAGE_ACCESS_TOKEN : env.INSTAGRAM_ACCESS_TOKEN
      if (!id || !token) throw new Error(`${channel} no configurado`)
      return post(`${GRAPH}/${id}/messages`, token, {
        recipient: { id: to },
        messaging_type: 'RESPONSE',
        message: { attachment: { type: 'image', payload: { url, is_reusable: true } } },
      })
    }
  }
}

/** Envía un video por URL pública (mp4 corto, ≤16 MB). Meta descarga la URL. */
export async function sendVideo(
  channel: Channel,
  to: string,
  url: string,
  caption?: string,
): Promise<unknown> {
  switch (channel) {
    case 'whatsapp': {
      if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN)
        throw new Error('WhatsApp no configurado')
      return post(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, env.WHATSAPP_ACCESS_TOKEN, {
        messaging_product: 'whatsapp',
        to,
        type: 'video',
        video: { link: url, caption: caption || undefined },
      })
    }
    case 'messenger':
    case 'instagram': {
      const id = channel === 'messenger' ? env.MESSENGER_PAGE_ID : env.IG_ACCOUNT_ID
      const token =
        channel === 'messenger' ? env.MESSENGER_PAGE_ACCESS_TOKEN : env.INSTAGRAM_ACCESS_TOKEN
      if (!id || !token) throw new Error(`${channel} no configurado`)
      return post(`${GRAPH}/${id}/messages`, token, {
        recipient: { id: to },
        messaging_type: 'RESPONSE',
        message: { attachment: { type: 'video', payload: { url, is_reusable: true } } },
      })
    }
  }
}

/** Envía un medio (imagen o video) por su tipo. */
export async function sendMedia(
  channel: Channel,
  to: string,
  media: { url: string; caption?: string; type: 'image' | 'video' },
): Promise<unknown> {
  return media.type === 'video'
    ? sendVideo(channel, to, media.url, media.caption)
    : sendImage(channel, to, media.url, media.caption)
}

/** Tarjeta de ubicación nativa en WhatsApp; en los demás canales cae a texto. */
export async function sendLocation(channel: Channel, to: string, loc: Location): Promise<unknown> {
  if (channel === 'whatsapp') {
    if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN)
      throw new Error('WhatsApp no configurado')
    return post(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, env.WHATSAPP_ACCESS_TOKEN, {
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        name: loc.name,
        address: loc.address,
      },
    })
  }
  const text = [loc.name, loc.address, `Mapa: https://maps.google.com/?q=${loc.latitude},${loc.longitude}`]
    .filter(Boolean)
    .join('\n')
  return sendText(channel, to, text)
}
