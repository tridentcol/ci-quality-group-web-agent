/**
 * Smoke del motor de generación (Step 9). Verifica el router (sin API) y un
 * turno real end-to-end: RAG + router + tool-calling con lookup_price.
 * Necesita DATABASE_URL + OPENAI_API_KEY. Limpia los datos de prueba.
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/generate-smoke.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, materials } from '../src/lib/db/schema'
import { selectModel, MODEL_DEFAULT, MODEL_ESCALATED } from '../src/lib/ai/router'
import { generateReply } from '../src/lib/ai/generate'

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  // ── Router (sin llamadas a OpenAI) ──
  assert(
    selectModel({ message: '¿Cuánto cuesta el cobre?', contextFound: true, topSimilarity: 0.7 }).model === MODEL_DEFAULT,
    'router: consulta simple con buen contexto → mini',
  )
  assert(
    selectModel({ message: '¿Qué dice la normativa ambiental para chatarrización?', contextFound: true, topSimilarity: 0.7 }).model === MODEL_ESCALATED,
    'router: tecnicismo → gpt-4o',
  )
  assert(
    selectModel({ message: 'hola', contextFound: false }).model === MODEL_ESCALATED,
    'router: sin contexto RAG → gpt-4o',
  )

  // ── End-to-end: pregunta de precio con cantidad (mayoreo) ──
  // Nombre único para no colisionar con la semilla (que ya trae "Cobre #1").
  const matName = 'Cobre SMOKE-Z9'
  const [cobre] = await db
    .insert(materials)
    .values({
      name: matName,
      unit: 'kg',
      retailPriceCop: '28000',
      wholesalePriceCop: '26000',
      wholesaleThreshold: '100',
      active: true,
    })
    .returning({ id: materials.id })
  const [conv] = await db
    .insert(conversations)
    .values({ channel: 'web', externalId: `gen-smoke-${cobre.id}`, status: 'bot_active' })
    .returning({ id: conversations.id })

  try {
    const res = await generateReply({
      message: `Buenas, ¿a cuánto me pagan el kilo de ${matName}? Tengo 200 kg para vender.`,
      conversationId: conv.id,
    })
    console.log(`  modelo=${res.model} (${res.routerReason}) · contexto=${res.contextUsed}`)
    console.log(`  tools=${JSON.stringify(res.toolCalls.map((t) => t.name))}`)
    console.log(`  respuesta: ${res.reply}`)

    const priceCall = res.toolCalls.find((t) => t.name === 'lookup_price')
    assert(!!priceCall, 'generate: llamó a lookup_price')
    const r = priceCall?.result as any
    assert(r?.available === true && r?.tier === 'wholesale' && r?.unitPriceCop === 26000, 'generate: lookup_price devolvió mayorista 26000 (200 ≥ 100)')
    assert(res.reply.trim().length > 0, 'generate: produjo una respuesta de texto')
    assert(res.reply.includes('26'), 'generate: la respuesta menciona el precio (26.000)')
  } finally {
    await db.delete(conversations).where(eq(conversations.id, conv.id))
    await db.delete(materials).where(eq(materials.id, cobre.id))
    console.log('— limpieza OK —')
  }
  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
