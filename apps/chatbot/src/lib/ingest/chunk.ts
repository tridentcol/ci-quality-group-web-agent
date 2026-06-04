/**
 * Troceado de texto para RAG (blueprint §9 Step 5): ~800 tokens por chunk con
 * solapamiento ~100 tokens. Sin dependencia de tokenizer: aproximamos
 * 1 token ≈ 4 caracteres (suficiente para acotar el tamaño de los chunks).
 */
const CHARS_PER_TOKEN = 4

export interface ChunkOptions {
  /** Tamaño objetivo por chunk, en tokens (default 800). */
  maxTokens?: number
  /** Solapamiento entre chunks consecutivos, en tokens (default 100). */
  overlapTokens?: number
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = (opts.maxTokens ?? 800) * CHARS_PER_TOKEN
  const overlapChars = (opts.overlapTokens ?? 100) * CHARS_PER_TOKEN

  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []

  // 1) Partir en unidades: párrafos, y los párrafos largos por frases.
  const units: string[] = []
  for (const para of clean.split(/\n{2,}/)) {
    const p = para.trim()
    if (!p) continue
    if (p.length <= maxChars) {
      units.push(p)
      continue
    }
    const sentences = p.match(/[^.!?\n]+[.!?]+|\S[^.!?\n]*$/g) ?? [p]
    let buf = ''
    for (const s of sentences) {
      if (buf && (buf.length + s.length) > maxChars) {
        units.push(buf.trim())
        buf = ''
      }
      // frase suelta más larga que maxChars → trocear duro
      if (s.length > maxChars) {
        for (let i = 0; i < s.length; i += maxChars) units.push(s.slice(i, i + maxChars).trim())
      } else {
        buf += s
      }
    }
    if (buf.trim()) units.push(buf.trim())
  }

  // 2) Empaquetar unidades en chunks ~maxChars con solapamiento.
  const chunks: string[] = []
  let current = ''
  for (const u of units) {
    if (current && current.length + u.length + 2 > maxChars) {
      chunks.push(current.trim())
      const tail = overlapChars > 0 ? current.slice(Math.max(0, current.length - overlapChars)) : ''
      current = tail ? `${tail}\n\n${u}` : u
    } else {
      current = current ? `${current}\n\n${u}` : u
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}
