import OpenAI from 'openai'
import { env } from '@/lib/env'

if (!env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY no está definida. Rellénala en .env.local (ver .env.example).')
}

// Cliente único de OpenAI (generación + embeddings comparten la misma API key).
// timeout + maxRetries: el SDK reintenta solo ante fallos transitorios (429, 5xx,
// red, timeout) con backoff exponencial, que es la causa más común de que un turno
// del bot se caiga. Sin esto, un blip de OpenAI dejaba al cliente sin respuesta.
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 60_000, // 60s por petición
  maxRetries: 3,
})
