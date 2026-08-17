/**
 * Normalización de eventos de los 3 canales Meta a una forma común
 * (blueprint §9 Step 10). Messenger e Instagram comparten el formato "page"
 * (entry[].messaging[]); WhatsApp Cloud usa entry[].changes[].value.messages[].
 * Los mensajes SIN texto (foto/audio/video/ubicación/sticker/documento) no se
 * ignoran en silencio: se normalizan como `kind:'unsupported'` para que el
 * pipeline le avise al cliente en vez de dejarlo sin respuesta (ver handle.ts).
 * Sí se ignoran las notificaciones sin contenido real (recibos de entrega/lectura).
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
  /** 'text' = mensaje normal; 'unsupported' = sin texto (foto/audio/video/ubicación/...). */
  kind: 'text' | 'unsupported'
  /** Tipo del adjunto no soportado (image/audio/video/location/document/...), si kind==='unsupported'. */
  unsupportedType?: string
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

// Tipo del primer adjunto de un mensaje de Messenger/Instagram (image/audio/video/
// file/location/fallback...) → normalizado a un puñado de valores conocidos.
function pageAttachmentType(attachments: unknown): string {
  const first = Array.isArray(attachments) ? (attachments[0] as Json | undefined) : undefined
  const t = typeof first?.type === 'string' ? first.type : 'file'
  return ['image', 'video', 'audio', 'location'].includes(t) ? t : 'file'
}

function normalizePage(body: Json, channel: Channel): NormalizedEvent[] {
  const out: NormalizedEvent[] = []
  for (const entry of asArray(body.entry)) {
    for (const m of asArray(entry.messaging)) {
      const sender = (m.sender as Json | undefined)?.id
      const recipient = (m.recipient as Json | undefined)?.id
      const msg = m.message as Json | undefined
      const postback = m.postback as Json | undefined

      // 1) Mensaje (texto o adjunto).
      if (msg && !msg.is_deleted) {
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

        const text = str(msg.text)
        if (text) {
          out.push({ channel, externalId, text, messageId, isEcho, kind: 'text' })
          continue
        }

        // Echo sin texto (un humano mandó solo una foto/adjunto desde la bandeja de
        // Meta): igual debe tomar el control del bot, aunque no traiga texto.
        if (isEcho) {
          out.push({ channel, externalId, text: '[adjunto sin texto]', messageId, isEcho: true, kind: 'text' })
          continue
        }

        // Mensaje entrante sin texto (foto/audio/video/ubicación/sticker/documento):
        // antes se ignoraba en silencio (el cliente quedaba sin ninguna respuesta,
        // indistinguible de "el bot no funciona"). Ahora se marca 'unsupported' para
        // que el pipeline avise en vez de callar. Si no hay adjunto tampoco (recibos
        // de entrega/lectura u otras notificaciones vacías), se ignora de verdad.
        if (msg.attachments) {
          out.push({
            channel,
            externalId,
            text: '',
            messageId,
            isEcho: false,
            kind: 'unsupported',
            unsupportedType: pageAttachmentType(msg.attachments),
          })
        }
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
        out.push({ channel, externalId, text, messageId, isEcho: false, kind: 'text' })
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
        const externalId = str(msg.from)
        const messageId = str(msg.id)
        if (!externalId || !messageId) continue
        const customerName = nameByWaId.get(externalId)

        if (msg.type === 'text') {
          const text = str((msg.text as Json | undefined)?.body)
          if (!text) continue
          out.push({ channel: 'whatsapp', externalId, text, messageId, isEcho: false, kind: 'text', customerName })
          continue
        }

        // No-texto (image/audio/video/document/location/sticker/contacts/...): antes
        // se ignoraba en silencio. Ahora se marca 'unsupported' para avisar en vez de
        // dejar al cliente sin respuesta.
        out.push({
          channel: 'whatsapp',
          externalId,
          text: '',
          messageId,
          isEcho: false,
          kind: 'unsupported',
          unsupportedType: typeof msg.type === 'string' ? msg.type : 'file',
          customerName,
        })
      }
    }
  }
  return out
}
