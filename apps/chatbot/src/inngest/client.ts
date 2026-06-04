import { Inngest } from 'inngest'

// Cliente Inngest. Lee INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY del entorno.
export const inngest = new Inngest({ id: 'ci-quality-group-chatbot' })

// Catálogo de eventos (tipado mínimo de los payloads).
export type IngestSourceUploaded = {
  name: 'ingest/source.uploaded'
  data: { sourceId: string }
}

// Memoria (Step 9B): al cerrar/inactivarse una conversación → actualizar perfil;
// cuando crece demasiado → resumir lo anterior en conversations.summary.
export type ConversationEnded = {
  name: 'memory/conversation.ended'
  data: { conversationId: string }
}
export type ConversationSummarize = {
  name: 'memory/conversation.summarize'
  data: { conversationId: string }
}

// Cumplimiento (Step 13): disparo manual del job de retención (también corre por cron).
export type RetentionRun = {
  name: 'compliance/retention.run'
  data: Record<string, never>
}
