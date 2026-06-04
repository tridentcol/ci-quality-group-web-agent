import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { knowledgeSources, knowledgeChunks } from '../src/lib/db/schema'

const id = process.argv[2]
if (!id) throw new Error('uso: ingest-check.ts <sourceId>')

async function main() {
  for (let i = 0; i < 40; i++) {
    const [src] = await db
      .select({ status: knowledgeSources.status, error: knowledgeSources.error })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, id))
    const chunks = await db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, id))
    console.log(`[${i}] status=${src?.status} chunks=${chunks.length}${src?.error ? ` error=${src.error}` : ''}`)
    if (src?.status === 'ready' || src?.status === 'failed') break
    await new Promise((r) => setTimeout(r, 1500))
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
