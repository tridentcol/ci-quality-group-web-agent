/**
 * Smoke de las tools del bot (Step 8). Crea datos de prueba, ejerce cada tool
 * y limpia. No necesita servidores; sí DATABASE_URL + OPENAI_API_KEY (get_location
 * usa RAG/embeddings).
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/tools-smoke.ts
 */
import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, knowledgeGaps, leads, materials } from '../src/lib/db/schema'
import {
  executeTool,
  captureLead,
  requestHumanHandoff,
  getLocation,
  logKnowledgeGap,
} from '../src/lib/ai/tools'

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  // ── datos de prueba ──
  const [cobre] = await db
    .insert(materials)
    .values({
      name: 'TEST Cobre #1',
      unit: 'kg',
      retailPriceCop: '28000',
      wholesalePriceCop: '26000',
      wholesaleThreshold: '100',
      active: true,
    })
    .returning({ id: materials.id })
  const [inactivo] = await db
    .insert(materials)
    .values({ name: 'TEST Inactivo', unit: 'kg', retailPriceCop: '9000', active: false })
    .returning({ id: materials.id })

  const [conv] = await db
    .insert(conversations)
    .values({ channel: 'web', externalId: `smoke-${cobre.id}`, status: 'bot_active' })
    .returning({ id: conversations.id })

  try {
    // ── lookup_price (vía dispatcher, ejerce Zod) ──
    const retail = (await executeTool('lookup_price', { material: 'TEST Cobre #1' })) as any
    assert(retail.available && retail.tier === 'retail' && retail.unitPriceCop === 28000, 'lookup_price sin cantidad → minorista 28000')

    const below = (await executeTool('lookup_price', { material: 'TEST Cobre #1', quantity: 50 })) as any
    assert(below.tier === 'retail' && below.totalCop === 28000 * 50, 'cantidad < umbral → minorista')

    const above = (await executeTool('lookup_price', { material: 'TEST Cobre #1', quantity: 150 })) as any
    assert(above.tier === 'wholesale' && above.unitPriceCop === 26000 && above.totalCop === 26000 * 150, 'cantidad ≥ umbral → mayorista 26000')

    const inact = (await executeTool('lookup_price', { material: 'TEST Inactivo' })) as any
    assert(inact.available === false && inact.reason === 'inactive', 'material inactivo → no disponible (inactive)')

    const missing = (await executeTool('lookup_price', { material: 'No existe XYZ' })) as any
    assert(missing.available === false && missing.reason === 'not_found', 'material inexistente → no disponible (not_found)')

    // ── capture_lead ──
    const lead = await captureLead(
      { name: 'Juan Prueba', contact: '3001234567', interest: 'TEST Cobre #1', quantity: 200, requested_discount: true },
      { conversationId: conv.id },
    )
    const [leadRow] = await db.select().from(leads).where(eq(leads.id, lead.leadId))
    assert(!!leadRow && leadRow.materialId === cobre.id && leadRow.requestedDiscount === true, 'capture_lead inserta lead y enlaza material por interés')

    // ── request_human_handoff ──
    await requestHumanHandoff({ reason: 'cliente pide hablar con un asesor' }, { conversationId: conv.id })
    const [convRow] = await db.select().from(conversations).where(eq(conversations.id, conv.id))
    assert(convRow.status === 'human_controlled', 'request_human_handoff → status human_controlled')

    // ── log_knowledge_gap ──
    const gap = await logKnowledgeGap({ question: '¿Reciben baterías de litio?' }, { conversationId: conv.id })
    const [gapRow] = await db.select().from(knowledgeGaps).where(eq(knowledgeGaps.id, gap.gapId))
    assert(!!gapRow && gapRow.status === 'open', 'log_knowledge_gap inserta hueco abierto')

    // ── get_location (RAG; base vacía → found:false está OK) ──
    const loc = await getLocation()
    assert(typeof loc.found === 'boolean', `get_location ejecuta (found=${loc.found})`)

    // limpieza del gap (la FK lo deja en null al borrar la conversación)
    await db.delete(knowledgeGaps).where(eq(knowledgeGaps.id, gap.gapId))
  } finally {
    // ── limpieza ──
    await db.delete(conversations).where(eq(conversations.id, conv.id)) // cascade → leads
    await db.delete(materials).where(inArray(materials.id, [cobre.id, inactivo.id]))
    console.log('— limpieza OK —')
  }
  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
