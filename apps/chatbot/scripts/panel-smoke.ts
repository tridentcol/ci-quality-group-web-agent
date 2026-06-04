/**
 * Smoke de las APIs del panel del Step 11 (leads, conversations, gaps).
 * Ejerce los handlers directamente (la auth vive en proxy.ts). Necesita
 * DATABASE_URL + OPENAI_API_KEY (gaps embebe + verifica RAG). Limpia todo.
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/panel-smoke.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, knowledgeGaps, knowledgeSources, leads, materials, messages } from '../src/lib/db/schema'
import { GET as leadsGET, PATCH as leadsPATCH } from '../src/app/api/panel/leads/route'
import { GET as convGET, PATCH as convPATCH } from '../src/app/api/panel/conversations/route'
import { GET as gapsGET, PATCH as gapsPATCH } from '../src/app/api/panel/gaps/route'
import { retrieve } from '../src/lib/ai/retrieve'

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}
const patchReq = (body: unknown) =>
  new Request('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const getReq = (qs = '') => new Request(`http://localhost/x${qs}`)
const read = async (r: Response) => ({ status: r.status, body: await r.json() })

async function main() {
  // ── setup ──
  const [mat] = await db.insert(materials).values({ name: 'PANEL-SMOKE Cobre', unit: 'kg', retailPriceCop: '28000', active: true }).returning({ id: materials.id })
  const [conv] = await db.insert(conversations).values({ channel: 'whatsapp', externalId: `panel-${mat.id}`, customerName: 'Ana', status: 'bot_active' }).returning({ id: conversations.id })
  await db.insert(messages).values([
    { conversationId: conv.id, role: 'user', content: '¿Compran cobre?' },
    { conversationId: conv.id, role: 'assistant', content: 'Sí, compramos cobre.' },
  ])
  const [lead] = await db.insert(leads).values({ conversationId: conv.id, name: 'Ana', contact: '3105550000', interest: 'cobre', materialId: mat.id, requestedDiscount: true }).returning({ id: leads.id })
  const [gap] = await db.insert(knowledgeGaps).values({ conversationId: conv.id, question: '¿Reciben baterías de plomo-ácido para chatarrizar?' }).returning({ id: knowledgeGaps.id })

  let faqSourceId: string | undefined

  try {
    // ── Leads ──
    const lg = await read(await leadsGET())
    const leadRow = (lg.body.data as any[]).find((l) => l.id === lead.id)
    assert(!!leadRow && leadRow.materialName === 'PANEL-SMOKE Cobre' && leadRow.channel === 'whatsapp', 'leads GET incluye material y canal')

    const lp = await read(await leadsPATCH(patchReq({ id: lead.id, status: 'quoted', discountApprovedPct: 10 })))
    assert(lp.body.data?.status === 'quoted' && lp.body.data?.discountApprovedPct === '10', 'leads PATCH actualiza estado y descuento')

    // ── Conversations ──
    const cl = await read(await convGET(getReq()))
    const convRow = (cl.body.data as any[]).find((c) => c.id === conv.id)
    assert(!!convRow && convRow.messageCount === 2, 'conversations GET lista con conteo de mensajes')

    const ct = await read(await convGET(getReq(`?id=${conv.id}`)))
    assert(ct.body.data?.messages?.length === 2, 'conversations GET ?id devuelve el hilo')

    const cp = await read(await convPATCH(patchReq({ id: conv.id, status: 'human_controlled' })))
    assert(cp.body.data?.status === 'human_controlled', 'conversations PATCH toma el control (human_controlled)')

    // ── Gaps ──
    const gOpen = await read(await gapsGET(getReq()))
    assert((gOpen.body.data as any[]).some((g) => g.id === gap.id), 'gaps GET lista los abiertos')

    const answer = 'Sí, recibimos baterías de plomo-ácido. Se pagan por kilo según cotización del día.'
    const gr = await read(await gapsPATCH(patchReq({ id: gap.id, answer })))
    faqSourceId = gr.body.data?.sourceId
    assert(gr.body.data?.gap?.status === 'resolved' && gr.body.data?.chunks > 0, 'gaps PATCH resuelve y embebe FAQ')

    // El bucle de aprendizaje cierra: la FAQ es recuperable por RAG.
    const hits = await retrieve('¿reciben baterías de plomo ácido?', 3, 0.2)
    const found = hits.some((h) => h.content.includes('plomo-ácido'))
    console.log(`  RAG hits=${hits.length} top=${hits[0]?.similarity?.toFixed(2)}`)
    assert(found, 'gaps: la FAQ recién creada es recuperable por RAG (aprendizaje cerrado)')
  } finally {
    if (faqSourceId) await db.delete(knowledgeSources).where(eq(knowledgeSources.id, faqSourceId)) // cascade → chunks
    await db.delete(knowledgeGaps).where(eq(knowledgeGaps.id, gap.id))
    await db.delete(conversations).where(eq(conversations.id, conv.id)) // cascade → messages, leads
    await db.delete(materials).where(eq(materials.id, mat.id))
    console.log('— limpieza OK —')
  }

  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
