import { cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeChunks, knowledgeSources } from '@/lib/db/schema'
import { embed } from './embed'
import { PRIORITY_BOOST, PRIORITY_BOOST_MAX } from './rag-config'

export interface RetrievedChunk {
  id: string
  content: string
  similarity: number
  metadata: unknown
}

/**
 * Búsqueda vectorial (RAG) — blueprint §9 Step 4.
 * Embebe la consulta y recupera los top-K chunks por similitud coseno (índice
 * HNSW `vector_cosine_ops`). El filtro usa la similitud cruda; el ORDEN aplica un
 * pequeño boost por `priority` de la fuente para que, ante similitud parecida,
 * gane la info más autoritativa/reciente.
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
  // score efectivo solo para ordenar: similitud + boost acotado por prioridad.
  // Las constantes van como literales SQL (no bind params) para que Postgres no
  // se quede sin tipo en la aritmética ("could not determine data type").
  const boost = sql.raw(String(PRIORITY_BOOST))
  const boostMax = sql.raw(String(PRIORITY_BOOST_MAX))
  const ranked = sql<number>`${similarity} + ${boost} * LEAST(GREATEST(${knowledgeSources.priority}, 0), ${boostMax})`

  return db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      similarity,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeSources, eq(knowledgeChunks.sourceId, knowledgeSources.id))
    .where(gt(similarity, minScore))
    .orderBy(desc(ranked))
    .limit(k)
}
