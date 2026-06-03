import { openai } from './openai'

/**
 * Embeddings con text-embedding-3-small (1536 dim) — blueprint §2/§9 Step 4.
 * Mismo proveedor que la generación: 1 API key, 1 factura.
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/** Embebe un texto en un vector de 1536 dimensiones. */
export async function embed(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, ' ').trim()
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input })
  return res.data[0].embedding
}

/** Embebe varios textos en una sola llamada (más barato al ingerir). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const input = texts.map((t) => t.replace(/\n/g, ' ').trim())
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input })
  // La API conserva el orden de entrada; ordenamos por index por seguridad.
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}
