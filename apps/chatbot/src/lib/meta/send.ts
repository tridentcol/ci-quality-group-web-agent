import { env } from '@/lib/env'
import type { Channel } from './normalize'

/**
 * Envío por canal (Send API de Meta) — blueprint §9 Step 10.
 * Texto, quick replies (Messenger/Instagram) y tarjeta de ubicación.
 * Lanza si el canal no tiene credenciales; el webhook captura y loguea.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

export interface SendOptions {
  /** Respuestas rápidas (solo Messenger/Instagram). */
  quickReplies?: string[]
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

export async function sendText(
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
