// Contrato de integración web ↔ bot (plan maestro §5).
// Única fuente de verdad para POST panel.<dominio>/api/chat/web.
// Consumido por apps/chatbot (handler) y apps/website (ChatWidget).

/** Canal de origen de una conversación. Texto libre por convención (plan maestro §6). */
export type Channel = 'messenger' | 'whatsapp' | 'instagram' | 'web'

/** Cuerpo de la petición que envía el ChatWidget de la web. */
export interface ChatRequest {
  /** Identificador anónimo de sesión del visitante (== conversations.external_id en canal web). */
  sessionId: string
  /** Mensaje del usuario. */
  message: string
}

/** Respuesta del bot al ChatWidget. */
export interface ChatResponse {
  /** Texto de respuesta del bot. */
  reply: string
  /** true si la conversación pasó a control humano (handoff). */
  handoff?: boolean
  /** Sugerencias de respuesta rápida para el usuario. */
  quickReplies?: string[]
}
