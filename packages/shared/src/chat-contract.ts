// Contrato de integración web ↔ bot (plan maestro §5).
// Única fuente de verdad para POST panel.<dominio>/api/chat/web.
// Consumido por apps/chatbot (handler) y apps/website (ChatWidget).
// Debe reflejar EXACTAMENTE la forma real de apps/chatbot/src/app/api/chat/web/route.ts.

/** Canal de origen de una conversación. Texto libre por convención (plan maestro §6). */
export type Channel = 'messenger' | 'whatsapp' | 'instagram' | 'web'

/** Cuerpo de la petición que envía el ChatWidget de la web. */
export interface ChatRequest {
  /** Identificador anónimo de sesión del visitante (== conversations.external_id en canal web). */
  sessionId: string
  /** Mensaje del usuario. */
  message: string
}

/** Medio (imagen/video) adjunto a una respuesta del bot. */
export interface MediaAttachment {
  url: string
  caption: string
  type: 'image' | 'video'
}

/** Tarjeta de ubicación devuelta cuando el bot usa la tool `get_location`. */
export interface LocationCard {
  latitude: number
  longitude: number
  name?: string
  address?: string
  mapsUrl?: string
}

/** Cuerpo de `data` en una respuesta exitosa del bot al ChatWidget. */
export interface ChatResponse {
  /** Texto de respuesta del bot. */
  reply: string
  /** true si la conversación pasó a control humano (handoff). */
  handoff?: boolean
  /** Medios (imagen/video) a adjuntar a la respuesta. */
  attachments?: MediaAttachment[]
  /** Tarjeta de ubicación, si el bot usó `get_location` y hay sede configurada. */
  location?: LocationCard | null
}

/** Cuerpo de `data` en la respuesta de GET (saludo inicial de la burbuja). */
export interface ChatWelcomeResponse {
  botName: string
  welcomeMessage: string
}

/** Envelope de error estándar de la API. */
export interface ChatApiError {
  code: string
  message: string
}

/**
 * Respuesta completa de POST /api/chat/web (éxito o error).
 * No es un union discriminado a propósito: `success` no siempre viene
 * acompañado de `data`/`error` de forma estricta en el JSON real (p.ej. un
 * parseo fallido puede dejar `data`/`error` undefined), así que ambos campos
 * quedan opcionales sobre el mismo tipo — igual que el body real.
 */
export interface ChatApiResponse {
  success: boolean
  data?: ChatResponse
  error?: ChatApiError
}

/** Respuesta completa de GET /api/chat/web (éxito o error). */
export interface ChatWelcomeApiResponse {
  success: boolean
  data?: ChatWelcomeResponse
  error?: ChatApiError
}
