import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { ingestSource } from '@/inngest/functions/ingest-source'
import { updateProfile } from '@/inngest/functions/update-profile'
import { summarizeConversation } from '@/inngest/functions/summarize'
import { retentionCleanup } from '@/inngest/functions/retention'
import { idleMemorySync } from '@/inngest/functions/idle-memory-sync'

// Endpoint de Inngest (público; Inngest firma sus peticiones).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestSource, updateProfile, summarizeConversation, retentionCleanup, idleMemorySync],
})
