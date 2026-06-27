import { after } from 'next/server'
import { verifySignature, verifyWebhookChallenge } from '@/lib/meta/verify'
import { normalize } from '@/lib/meta/normalize'
import { handleEvent } from '@/lib/meta/handle'

// Webhook unificado de Meta (Messenger/WhatsApp/Instagram) — blueprint §9 Step 10.
// Público: NO usa Clerk; se protege con verify_token (GET) y firma HMAC (POST).
export const runtime = 'nodejs'

// GET — handshake de verificación del webhook (devuelve hub.challenge).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const challenge = verifyWebhookChallenge(params)
  if (challenge === null) {
    console.warn('webhook/meta: handshake fallido (verify_token no coincide o falta)')
    return new Response('Forbidden', { status: 403 })
  }
  return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
}

// POST — recepción de eventos. Verifica firma, responde 200 < 20s y procesa
// en segundo plano con after() (Meta reintenta si no recibe 200 a tiempo).
export async function POST(req: Request) {
  const raw = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(raw, signature)) {
    console.warn('webhook/meta: firma X-Hub-Signature-256 inválida o ausente')
    return new Response('Invalid signature', { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const events = normalize(body)

  after(async () => {
    for (const event of events) {
      try {
        await handleEvent(event)
      } catch (err) {
        // Nunca propagamos: el error se loguea y no afecta a Meta (ya respondimos 200).
        console.error('webhook/meta handleEvent error:', err instanceof Error ? err.message : err)
      }
    }
  })

  return new Response('EVENT_RECEIVED', { status: 200 })
}
