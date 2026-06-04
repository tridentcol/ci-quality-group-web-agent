/**
 * Smoke de la memoria (Step 9B). Parte A: funciones puras + loadMemory/appendMessage
 * (solo BD). Parte B: jobs Inngest memory/update-profile y memory/summarize end-to-end
 * vía el Dev Server (requiere `pnpm dev:bot` + `npx inngest-cli dev` + INNGEST_DEV=1).
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/memory-smoke.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, customerProfiles } from '../src/lib/db/schema'
import { inngest } from '../src/inngest/client'
import {
  appendMessage,
  buildCustomerSummary,
  loadMemory,
  mergeFacts,
  parseFacts,
} from '../src/lib/ai/memory'

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function poll<T>(fn: () => Promise<T>, ok: (v: T) => boolean, tries = 30, gap = 1500) {
  for (let i = 0; i < tries; i++) {
    const v = await fn()
    if (ok(v)) return v
    await sleep(gap)
  }
  return fn()
}

async function main() {
  // ── Parte A: funciones puras ──
  const merged = mergeFacts(
    parseFacts({ materialsOfInterest: ['Cobre'], buyerOrSeller: 'vende' }),
    parseFacts({ materialsOfInterest: ['cobre', 'Aluminio'], typicalVolume: '2 ton/mes' }),
  )
  assert(merged.materialsOfInterest?.length === 2, 'mergeFacts une materiales sin duplicar (case-insensitive)')
  assert(merged.buyerOrSeller === 'vende' && merged.typicalVolume === '2 ton/mes', 'mergeFacts conserva previo y añade nuevo')

  const summary = buildCustomerSummary({ name: 'Carlos', company: 'Reciclados del Valle', facts: merged })
  assert(!!summary && summary.includes('Carlos') && summary.includes('Cobre'), `buildCustomerSummary compone resumen ("${summary}")`)
  assert(buildCustomerSummary({ name: null, company: null, facts: {} }) === null, 'buildCustomerSummary vacío → null')

  // ── Parte B: loadMemory + appendMessage ──
  const channel = 'web'
  const externalId = `mem-smoke-${Date.now()}`

  const m1 = await loadMemory(channel, externalId)
  assert(!!m1.conversationId && !!m1.customerId, 'loadMemory crea conversación + perfil')
  assert(m1.history.length === 0 && m1.customerSummary === null, 'memoria nueva: historial vacío y sin resumen de cliente')

  await appendMessage(m1.conversationId, 'user', 'Hola, soy Carlos de Reciclados del Valle. Vendo cobre y aluminio.')
  await appendMessage(m1.conversationId, 'assistant', 'Hola Carlos, con gusto. ¿Qué cantidad maneja?')
  await appendMessage(m1.conversationId, 'user', 'Normalmente unas 2 toneladas al mes. Mi celular es 3105551234.')

  const m2 = await loadMemory(channel, externalId)
  assert(m2.conversationId === m1.conversationId, 'loadMemory reusa la misma conversación')
  assert(m2.history.length === 3 && m2.history[0].role === 'user', 'historial corto plazo carga los turnos')

  const convId = m1.conversationId
  const custId = m1.customerId

  try {
    // ── Parte C: job update-profile vía Dev Server ──
    await inngest.send({ name: 'memory/conversation.ended', data: { conversationId: convId } })
    const profile = await poll(
      async () => (await db.select().from(customerProfiles).where(eq(customerProfiles.id, custId)))[0],
      (p) => !!parseFacts(p?.facts).materialsOfInterest?.length,
    )
    const facts = parseFacts(profile?.facts)
    console.log(`  facts: ${JSON.stringify(facts)} | name=${profile?.name}`)
    assert(!!facts.materialsOfInterest?.length, 'update-profile extrajo materiales de interés a facts')

    // ── Parte D: job summarize vía Dev Server ──
    for (let i = 0; i < 12; i++) {
      await appendMessage(convId, i % 2 === 0 ? 'user' : 'assistant', `Mensaje de relleno número ${i} sobre precios y entregas de cobre.`)
    }
    await inngest.send({ name: 'memory/conversation.summarize', data: { conversationId: convId } })
    const conv = await poll(
      async () => (await db.select().from(conversations).where(eq(conversations.id, convId)))[0],
      (c) => !!c?.summary,
    )
    console.log(`  summary: ${conv?.summary}`)
    assert(!!conv?.summary, 'summarize escribió conversations.summary')
  } finally {
    await db.delete(conversations).where(eq(conversations.id, convId)) // cascade → messages
    await db.delete(customerProfiles).where(eq(customerProfiles.id, custId))
    console.log('— limpieza OK —')
  }

  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
