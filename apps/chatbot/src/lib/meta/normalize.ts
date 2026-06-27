/**
 * Normalización de eventos de los 3 canales Meta a una forma común
 * (blueprint §9 Step 10). Messenger e Instagram comparten el formato "page"
 * (entry[].messaging[]); WhatsApp Cloud usa entry[].changes[].value.messages[].
 * Solo se procesan mensajes de texto; se ignoran adjuntos, reacciones y estados.
 */

export type Channel = 'messenger' | 'whatsapp' | 'instagram'

export interface NormalizedEvent {
  channel: Channel
  /** Id del usuario; clave de la conversación (en echo, el destinatario). */
  externalId: string
  text: string
  /** Id del mensaje en Meta (idempotencia). */
  messageId: string
  customerName?: string
  /** Mensaje enviado por un humano desde la bandeja de Meta (relevo). */
  isEcho: boolean
}

type Json = Record<string, unknown>
const asArray = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : [])
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v : undefined

export function normalize(body: unknown): NormalizedEvent[] {
  if (!body || typeof body !== 'object') return []
  const obj = (body as Json).object
  if (obj === 'whatsapp_business_account') return normalizeWhatsApp(body as Json)
  if (obj === 'instagram') return normalizePage(body as Json, 'instagram')
  if (obj === 'page') return normalizePage(body as Json, 'messenger')
  return []
}

function normalizePage(body: Json, channel: Channel): NormalizedEvent[] {
  const out: NormalizedEvent[] = []
  for (const entry of asArray(body.entry)) {
    for (const m of asArray(entry.messaging)) {
      const sender = (m.sender as Json | undefined)?.id
      const recipient = (m.recipient as Json | undefined)?.id
      const msg = m.message as Json | undefined
      const postback = m.postback as Json | undefined

      // 1) Mensaje de texto (ignoramos adjuntos/no-texto por ahora).
      if (msg && !msg.is_deleted) {
        const text = str(msg.text)
        if (!text) continue
        const isEcho = !!msg.is_echo
        // Echo enviado por una APP (incluido nuestro propio bot) trae `app_id`.
        // Lo ignoramos: si no, el bot tomaría su propia respuesta como "un humano
        // respondió" y se pausaría a sí mismo. El relevo humano se detecta por los
        // echos SIN app_id (respuestas escritas a mano desde la bandeja de Meta).
        if (isEcho && msg.app_id != null) continue
        // En echo, el usuario de la conversación es el destinatario, no la página.
        const externalId = str(isEcho ? recipient : sender)
        const messageId = str(msg.mid)
        if (!externalId || !messageId) continue
        out.push({ channel, externalId, text, messageId, isEcho })
        continue
      }

      // 2) Postback (botón/menú): tratamos su payload como el texto del usuario.
      if (postback) {
        const text = str(postback.payload) ?? str(postback.title)
        const externalId = str(sender)
        // Algunos postbacks no traen mid; derivamos uno estable (sender+timestamp)
        // para idempotencia.
        const ts = typeof m.timestamp === 'number' ? m.timestamp : null
        const messageId =
          str(postback.mid) ?? (externalId ? `pb:${externalId}:${ts ?? text}` : undefined)
        if (!text || !externalId || !messageId) continue
        out.push({ channel, externalId, text, messageId, isEcho: false })
      }
    }
  }
  return out
}

function normalizeWhatsApp(body: Json): NormalizedEvent[] {
  const out: NormalizedEvent[] = []
  for (const entry of asArray(body.entry)) {
    for (const change of asArray(entry.changes)) {
      const value = change.value as Json | undefined
      if (!value) continue

      const nameByWaId = new Map<string, string>()
      for (const c of asArray(value.contacts)) {
        const waId = str(c.wa_id)
        const name = str((c.profile as Json | undefined)?.name)
        if (waId && name) nameByWaId.set(waId, name)
      }

      for (const msg of asArray(value.messages)) {
        if (msg.type !== 'text') continue
        const text = str((msg.text as Json | undefined)?.body)
        const externalId = str(msg.from)
        const messageId = str(msg.id)
        if (!text || !externalId || !messageId) continue

        out.push({
          channel: 'whatsapp',
          externalId,
          text,
          messageId,
          isEcho: false,
          customerName: nameByWaId.get(externalId),
        })
      }
    }
  }
  return out
}
