import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { ingestSource } from '@/inngest/functions/ingest-source'

// Endpoint de Inngest (público; Inngest firma sus peticiones).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestSource],
})
