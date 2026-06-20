import { cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeChunks, knowledgeQa, knowledgeSources } from '@/lib/db/schema'
import { embed } from './embed'
import { PRIORITY_BOOST, PRIORITY_BOOST_MAX } from './rag-config'

export interface RetrievedChunk {
  id: string
  content: string
  similarity: number
  metadata: unknown
}

// Boost por prioridad de la fuente (literal SQL para no dejar params sin tipo).
const boost = sql.raw(String(PRIORITY_BOOST))
const boostMax = sql.raw(String(PRIORITY_BOOST_MAX))
const rankedBy = (similarity: ReturnType<typeof sql<number>>) =>
  sql<number>`${similarity} + ${boost} * LEAST(GREATEST(${knowledgeSources.priority}, 0), ${boostMax})`

/**
 * Búsqueda vectorial (RAG) — blueprint §9 Step 4.
 * Embebe la consulta una vez y busca en DOS lugares: los fragmentos del documento
 * (`knowledge_chunks`) y las preguntas frecuentes generadas (`knowledge_qa`, donde
 * el embedding es de la pregunta → mejor match para consultas de clientes). El
 * filtro usa la similitud cruda; el ORDEN aplica un boost por `priority` de la
 * fuente. Se mezclan ambos conjuntos y se devuelven los top-K.
 *
 * @param query     texto de la consulta del usuario
 * @param k         nº de resultados a devolver (default 5)
 * @param minScore  umbral de similitud [0..1] para descartar ruido (default 0)
 */
export async function retrieve(
  query: string,
  k = 5,
  minScore = 0,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embed(query)

  // 1) Fragmentos del documento.
  const chunkSim = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, queryEmbedding)})`
  const chunksP = db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      similarity: chunkSim,
      ranked: rankedBy(chunkSim),
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeSources, eq(knowledgeChunks.sourceId, knowledgeSources.id))
    .where(gt(chunkSim, minScore))
    .orderBy(desc(rankedBy(chunkSim)))
    .limit(k)

  // 2) Preguntas frecuentes generadas (P/R). Se devuelve el par como contenido.
  const qaSim = sql<number>`1 - (${cosineDistance(knowledgeQa.embedding, queryEmbedding)})`
  const qaP = db
    .select({
      id: knowledgeQa.id,
      content: sql<string>`'Pregunta: ' || ${knowledgeQa.question} || E'\nRespuesta: ' || ${knowledgeQa.answer}`,
      sourceId: knowledgeQa.sourceId,
      similarity: qaSim,
      ranked: rankedBy(qaSim),
    })
    .from(knowledgeQa)
    .innerJoin(knowledgeSources, eq(knowledgeQa.sourceId, knowledgeSources.id))
    .where(gt(qaSim, minScore))
    .orderBy(desc(rankedBy(qaSim)))
    .limit(k)

  const [chunkRows, qaRows] = await Promise.all([chunksP, qaP])

  const merged: (RetrievedChunk & { ranked: number })[] = [
    ...chunkRows.map((r) => ({
      id: r.id,
      content: r.content,
      similarity: r.similarity,
      metadata: r.metadata,
      ranked: r.ranked,
    })),
    ...qaRows.map((r) => ({
      id: r.id,
      content: r.content,
      similarity: r.similarity,
      metadata: { qa: true, sourceId: r.sourceId },
      ranked: r.ranked,
    })),
  ]

  return merged
    .sort((a, b) => b.ranked - a.ranked)
    .slice(0, k)
    .map(({ ranked: _ranked, ...rest }) => rest)
}
