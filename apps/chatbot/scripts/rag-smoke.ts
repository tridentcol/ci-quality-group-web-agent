import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeChunks, knowledgeSources } from '@/lib/db/schema'
import { embed } from '@/lib/ai/embed'
import { retrieve } from '@/lib/ai/retrieve'

/**
 * Smoke test del RAG (blueprint §9 Step 4): inserta una fuente + chunk con embedding
 * y comprueba que una consulta relacionada lo recupera por similitud. Limpia al final.
 *
 *   pnpm --filter chatbot rag:smoke
 */
async function main() {
  // 1) Fuente de prueba
  const [source] = await db
    .insert(knowledgeSources)
    .values({ type: 'faq', name: '__rag_smoke__', status: 'ready' })
    .returning({ id: knowledgeSources.id })

  try {
    // 2) Chunk conocido + embedding
    const content =
      'CI Quality Group compra cobre #1 a $28.000 COP por kilo, y al por mayor a $30.000 desde 100 kg.'
    const embedding = await embed(content)
    if (embedding.length !== 1536) {
      throw new Error(`Embedding inesperado: ${embedding.length} dims (esperado 1536)`)
    }
    await db.insert(knowledgeChunks).values({ sourceId: source.id, content, embedding })
    console.log('✓ Chunk insertado con embedding de', embedding.length, 'dims')

    // 3) Recuperar por una consulta relacionada (no idéntica)
    const query = '¿a cuánto pagan el kilo de cobre?'
    const results = await retrieve(query, 3)
    console.log(`\n🔎 Query: "${query}"`)
    for (const r of results) {
      console.log(`  • [${r.similarity.toFixed(3)}] ${r.content.slice(0, 80)}…`)
    }

    const top = results[0]
    if (top && top.content === content && top.similarity > 0.3) {
      console.log('\n✅ RAG OK: el chunk se recuperó como mejor match por similitud.')
    } else {
      throw new Error('El chunk esperado no fue el mejor match (revisa embeddings/índice).')
    }
  } finally {
    // 4) Limpieza (cascade borra el chunk)
    await db.delete(knowledgeSources).where(eq(knowledgeSources.id, source.id))
    console.log('🧹 Limpieza hecha (fuente de prueba borrada).')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ RAG smoke falló:', err)
  process.exit(1)
})
