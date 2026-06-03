import OpenAI from 'openai'
import { env } from '@/lib/env'

if (!env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY no está definida. Rellénala en .env.local (ver .env.example).')
}

// Cliente único de OpenAI (generación + embeddings comparten la misma API key).
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
