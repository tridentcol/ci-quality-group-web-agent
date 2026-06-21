import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeChunks, knowledgeGaps, knowledgeSources } from '@/lib/db/schema'
import { chunkText } from '@/lib/ingest/chunk'
import { embedBatch } from '@/lib/ai/embed'

/**
 * Bucle de aprendizaje (blueprint §9 Step 11): al resolver un hueco, la
 * respuesta del admin se convierte en una fuente de conocimiento tipo FAQ,
 * se embebe (par pregunta/respuesta) y el hueco se marca como resuelto. Desde
 * ese momento el bot puede recuperar esa respuesta por RAG.
 *
 * Lógica compartida por la API del panel (`/api/panel/gaps`) y las pruebas.
 */
export async function resolveGapToKnowledge(
  gapId: string,
  question: string,
  answer: string,
): Promise<{ sourceId: string; chunks: number }> {
  // Par pregunta/respuesta como texto canónico (editable y recuperable).
  const text = `Pregunta: ${question}\nRespuesta: ${answer}`
  const chunks = chunkText(text)

  const [source] = await db
    .insert(knowledgeSources)
    .values({
      type: 'faq',
      name: `FAQ: ${question.slice(0, 80)}`,
      content: text,
      status: 'ready',
      chunkCount: chunks.length,
    })
    .returning({ id: knowledgeSources.id })

  const embeddings = await embedBatch(chunks)
  await db.insert(knowledgeChunks).values(
    chunks.map((content, i) => ({
      sourceId: source.id,
      content,
      embedding: embeddings[i],
      metadata: { faq: true, gapId, index: i },
    })),
  )

  await db
    .update(knowledgeGaps)
    .set({ status: 'resolved', resolvedAnswer: answer, resolvedAt: new Date() })
    .where(eq(knowledgeGaps.id, gapId))

  return { sourceId: source.id, chunks: chunks.length }
}
