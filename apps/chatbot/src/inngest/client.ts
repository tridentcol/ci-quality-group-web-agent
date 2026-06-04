import { Inngest } from 'inngest'

// Cliente Inngest. Lee INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY del entorno.
export const inngest = new Inngest({ id: 'ci-quality-group-chatbot' })

// Catálogo de eventos (tipado mínimo del payload de ingesta).
export type IngestSourceUploaded = {
  name: 'ingest/source.uploaded'
  data: { sourceId: string }
}
