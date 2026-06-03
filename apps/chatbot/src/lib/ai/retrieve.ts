import { cosineDistance, desc, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeChunks } from '@/lib/db/schema'
import { embed } from './embed'

export interface RetrievedChunk {
  id: string
  content: string
  similarity: number
  metadata: unknown
}

/**
 * Búsqueda vectorial (RAG) — blueprint §9 Step 4.
 * Embebe la consulta y recupera los top-K chunks por similitud coseno
 * (índice HNSW `vector_cosine_ops` en knowledge_chunks.embedding).
 *
 * @param query     texto de la consulta del usuario
 * @param k         nº de chunks a devolver (default 5)
 * @param minScore  umbral de similitud [0..1] para descartar ruido (default 0)
 */
export async function retrieve(
  query: string,
  k = 5,
  minScore = 0,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embed(query)

  // similitud coseno = 1 - distancia coseno
  const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, queryEmbedding)})`

  return db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      similarity,
    })
    .from(knowledgeChunks)
    .where(gt(similarity, minScore))
    .orderBy(desc(similarity))
    .limit(k)
}
