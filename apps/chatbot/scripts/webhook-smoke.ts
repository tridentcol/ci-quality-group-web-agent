/**
 * Smoke del webhook de Meta (Step 10). Parte A: unit de verify/normalize.
 * Parte B: e2e contra el dev server (firma HMAC válida → 200 → persiste
 * mensajes; idempotencia). Requiere `pnpm dev:bot` + META_APP_SECRET/
 * META_VERIFY_TOKEN en .env.local (valores de prueba) + OPENAI_API_KEY.
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/webhook-smoke.ts
 */
import { createHmac } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, customerProfiles, messages, webhookEvents } from '../src/lib/db/schema'
import { normalize } from '../src/lib/meta/normalize'
import { verifySignature, verifyWebhookChallenge } from '../src/lib/meta/verify'

const BASE = 'http://localhost:3000'
const SECRET = process.env.META_APP_SECRET!
const VERIFY = process.env.META_VERIFY_TOKEN!

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const sign = (raw: string) => 'sha256=' + createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex')

async function main() {
  // ── Parte A: verify ──
  const okChallenge = verifyWebhookChallenge(
    new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY, 'hub.challenge': '12345' }),
  )
  assert(okChallenge === '12345', 'verify: handshake correcto devuelve challenge')
  assert(
    verifyWebhookChallenge(new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'malo', 'hub.challenge': 'x' })) === null,
    'verify: verify_token incorrecto → null',
  )
  const raw = JSON.stringify({ hello: 'world' })
  assert(verifySignature(raw, sign(raw)), 'verify: firma HMAC válida → true')
  assert(!verifySignature(raw, 'sha256=deadbeef'), 'verify: firma inválida → false')

  // ── Parte A: normalize ──
  const msgr = normalize({ object: 'page', entry: [{ messaging: [{ sender: { id: 'U1' }, recipient: { id: 'PAGE' }, message: { mid: 'm1', text: 'hola' } }] }] })
  assert(msgr.length === 1 && msgr[0].channel === 'messenger' && msgr[0].externalId === 'U1' && !msgr[0].isEcho, 'normalize: messenger entrante')

  const echo = normalize({ object: 'page', entry: [{ messaging: [{ sender: { id: 'PAGE' }, recipient: { id: 'U1' }, message: { mid: 'm2', text: 'le respondo yo', is_echo: true } }] }] })
  assert(echo[0]?.isEcho === true && echo[0]?.externalId === 'U1', 'normalize: echo → isEcho true y externalId = destinatario')

  const wa = normalize({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: [{ wa_id: '573001', profile: { name: 'Ana' } }], messages: [{ from: '573001', id: 'wamid1', type: 'text', text: { body: 'precio cobre' } }] } }] }] })
  assert(wa[0]?.channel === 'whatsapp' && wa[0]?.externalId === '573001' && wa[0]?.customerName === 'Ana', 'normalize: whatsapp con nombre de contacto')

  const ig = normalize({ object: 'instagram', entry: [{ messaging: [{ sender: { id: 'IGU' }, recipient: { id: 'IGPAGE' }, message: { mid: 'igm1', text: 'hola ig' } }] }] })
  assert(ig[0]?.channel === 'instagram' && ig[0]?.externalId === 'IGU', 'normalize: instagram entrante')

  // ── Parte B: e2e contra el dev server ──
  // Firma inválida → 401.
  const bad = await fetch(`${BASE}/api/webhooks/meta`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' }, body: '{}' })
  assert(bad.status === 401, 'POST con firma inválida → 401')

  // GET handshake → 200 + challenge.
  const get = await fetch(`${BASE}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=abc987`)
  assert(get.status === 200 && (await get.text()) === 'abc987', 'GET handshake → 200 con challenge')

  // POST firmado con un mensaje real → 200 y procesamiento en segundo plano.
  const extId = `wh-smoke-${Date.now()}`
  const mid = `mid-${Date.now()}`
  const payload = JSON.stringify({ object: 'page', entry: [{ messaging: [{ sender: { id: extId }, recipient: { id: 'PAGE' }, message: { mid, text: 'Hola, ¿qué horario de atención manejan?' } }] }] })
  const res = await fetch(`${BASE}/api/webhooks/meta`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(payload) }, body: payload })
  assert(res.status === 200, 'POST firmado → 200 inmediato')

  // Poll: la conversación + mensaje del usuario deben aparecer (after() async).
  let conv: { id: string } | undefined
  for (let i = 0; i < 30; i++) {
    ;[conv] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.channel, 'messenger'), eq(conversations.externalId, extId)))
    if (conv) break
    await sleep(1500)
  }
  assert(!!conv, 'e2e: se creó la conversación de messenger')

  const countUser = async () =>
    conv
      ? (await db.select({ role: messages.role }).from(messages).where(eq(messages.conversationId, conv.id))).filter((m) => m.role === 'user').length
      : 0

  // Esperar a que se guarde el mensaje del cliente.
  let userCount = 0
  for (let i = 0; i < 20; i++) {
    userCount = await countUser()
    if (userCount >= 1) break
    await sleep(1000)
  }
  assert(userCount === 1, 'e2e: se guardó el mensaje del cliente (1)')

  // Idempotencia: re-enviar el mismo evento (mismo messageId) no añade otro 'user'.
  await fetch(`${BASE}/api/webhooks/meta`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(payload) }, body: payload })
  await sleep(5000)
  const userAfter = await countUser()
  assert(userAfter === 1, `e2e: idempotencia — reenvío no duplica el mensaje del cliente (${userCount} → ${userAfter})`)

  // Informativo: la respuesta del bot puede tardar (gpt-4o + tools); el envío real falla sin tokens.
  const all = conv ? await db.select({ role: messages.role }).from(messages).where(eq(messages.conversationId, conv.id)) : []
  console.log(`  roles persistidos: ${JSON.stringify(all.map((m) => m.role))}`)

  // ── limpieza ──
  if (conv) await db.delete(conversations).where(eq(conversations.id, conv.id))
  await db.delete(customerProfiles).where(and(eq(customerProfiles.channel, 'messenger'), eq(customerProfiles.externalId, extId)))
  await db.delete(webhookEvents).where(eq(webhookEvents.eventId, mid))
  console.log('— limpieza OK —')

  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
