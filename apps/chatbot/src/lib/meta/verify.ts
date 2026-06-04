import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Verificación del webhook de Meta (blueprint §8/§9 Step 10).
 *  - GET handshake: hub.mode=subscribe + hub.verify_token == META_VERIFY_TOKEN → devuelve hub.challenge.
 *  - POST: firma X-Hub-Signature-256 = HMAC-SHA256(rawBody, META_APP_SECRET).
 */

/** Devuelve el challenge si el handshake es válido; null si no. */
export function verifyWebhookChallenge(params: URLSearchParams): string | null {
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')
  if (mode === 'subscribe' && env.META_VERIFY_TOKEN && token === env.META_VERIFY_TOKEN) {
    return challenge ?? ''
  }
  return null
}

/** Comprueba la firma HMAC del cuerpo crudo. Sin secreto o firma → false. */
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!env.META_APP_SECRET) return false
  if (!signatureHeader?.startsWith('sha256=')) return false

  const expected = createHmac('sha256', env.META_APP_SECRET).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signatureHeader.slice('sha256='.length), 'hex')
  if (a.length !== b.length || a.length === 0) return false
  return timingSafeEqual(a, b)
}
