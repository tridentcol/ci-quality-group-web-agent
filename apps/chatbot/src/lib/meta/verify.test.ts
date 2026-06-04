import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifySignature, verifyWebhookChallenge } from './verify'

// vitest.setup.ts fija META_APP_SECRET y META_VERIFY_TOKEN antes de cargar env.
const SECRET = 'test-app-secret'
const VERIFY = 'test-verify-token'
const sign = (raw: string) => 'sha256=' + createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex')

describe('verifyWebhookChallenge', () => {
  it('handshake válido → devuelve el challenge', () => {
    const p = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY, 'hub.challenge': '12345' })
    expect(verifyWebhookChallenge(p)).toBe('12345')
  })

  it('verify_token incorrecto → null', () => {
    const p = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'malo', 'hub.challenge': 'x' })
    expect(verifyWebhookChallenge(p)).toBeNull()
  })

  it('modo distinto de subscribe → null', () => {
    const p = new URLSearchParams({ 'hub.mode': 'unsubscribe', 'hub.verify_token': VERIFY, 'hub.challenge': 'x' })
    expect(verifyWebhookChallenge(p)).toBeNull()
  })
})

describe('verifySignature', () => {
  it('firma HMAC válida → true', () => {
    const raw = JSON.stringify({ object: 'page', entry: [] })
    expect(verifySignature(raw, sign(raw))).toBe(true)
  })

  it('firma que no coincide → false', () => {
    expect(verifySignature(JSON.stringify({ a: 1 }), 'sha256=deadbeef')).toBe(false)
  })

  it('encabezado ausente o mal formado → false', () => {
    expect(verifySignature('{}', null)).toBe(false)
    expect(verifySignature('{}', 'md5=abc')).toBe(false)
  })
})
