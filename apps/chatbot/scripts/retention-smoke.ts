/**
 * Smoke de cumplimiento (Step 13). Parte A: borrado de perfil bajo solicitud
 * (DELETE de conversations). Parte B: job de retención e2e vía Dev Server
 * (borra lo vencido, conserva lo reciente). Requiere dev server + Inngest Dev
 * Server + INNGEST_DEV=1.
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/retention-smoke.ts
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, customerProfiles, leads, messages } from '../src/lib/db/schema'
import { inngest } from '../src/inngest/client'
import { DELETE as convDELETE } from '../src/app/api/panel/conversations/route'

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const exists = async (id: string) =>
  (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, id))).length > 0
const profExists = async (id: string) =>
  (await db.select({ id: customerProfiles.id }).from(customerProfiles).where(eq(customerProfiles.id, id))).length > 0

async function main() {
  // ── Parte A: borrado de perfil bajo solicitud ──
  const eraseExt = `erase-${Date.now()}`
  const [prof] = await db.insert(customerProfiles).values({ channel: 'web', externalId: eraseExt }).returning({ id: customerProfiles.id })
  const [conv] = await db.insert(conversations).values({ channel: 'web', externalId: eraseExt, customerId: prof.id }).returning({ id: conversations.id })
  await db.insert(messages).values({ conversationId: conv.id, role: 'user', content: 'borren mis datos por favor' })
  await db.insert(leads).values({ conversationId: conv.id, name: 'X', contact: '300' })

  const res = await convDELETE(new Request(`http://x/api/panel/conversations?id=${conv.id}&erase=customer`, { method: 'DELETE' }))
  const body = await res.json()
  assert(body.success && body.data?.erased === 'customer', 'DELETE erase=customer responde ok')
  assert(!(await exists(conv.id)), 'borrado: la conversación se eliminó (cascade mensajes/leads)')
  assert(!(await profExists(prof.id)), 'borrado: el perfil del cliente se eliminó')

  // ── Parte B: retención e2e vía Dev Server ──
  const stamp = Date.now()
  const oldExt = `ret-old-${stamp}`
  const newExt = `ret-new-${stamp}`
  const past = new Date()
  past.setDate(past.getDate() - 800) // ~2.2 años → supera retención (12 meses)

  const [oldProf] = await db.insert(customerProfiles).values({ channel: 'web', externalId: oldExt, lastSeenAt: past }).returning({ id: customerProfiles.id })
  const [oldConv] = await db.insert(conversations).values({ channel: 'web', externalId: oldExt, customerId: oldProf.id, lastMessageAt: past }).returning({ id: conversations.id })
  await db.insert(messages).values({ conversationId: oldConv.id, role: 'user', content: 'mensaje viejo' })
  const [newProf] = await db.insert(customerProfiles).values({ channel: 'web', externalId: newExt }).returning({ id: customerProfiles.id })
  const [newConv] = await db.insert(conversations).values({ channel: 'web', externalId: newExt, customerId: newProf.id }).returning({ id: conversations.id })

  try {
    await inngest.send({ name: 'compliance/retention.run', data: {} })

    let oldGone = false
    for (let i = 0; i < 30; i++) {
      if (!(await exists(oldConv.id))) {
        oldGone = true
        break
      }
      await sleep(1500)
    }
    assert(oldGone, 'retención: la conversación vencida (>12 meses) se borró')
    assert(!(await profExists(oldProf.id)), 'retención: el perfil vencido se borró')
    assert(await exists(newConv.id), 'retención: la conversación reciente se conservó')
    assert(await profExists(newProf.id), 'retención: el perfil reciente se conservó')
  } finally {
    await db.delete(conversations).where(and(eq(conversations.channel, 'web'), eq(conversations.externalId, newExt)))
    await db.delete(conversations).where(and(eq(conversations.channel, 'web'), eq(conversations.externalId, oldExt)))
    await db.delete(customerProfiles).where(eq(customerProfiles.id, newProf.id))
    await db.delete(customerProfiles).where(eq(customerProfiles.id, oldProf.id))
    console.log('— limpieza OK —')
  }

  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
