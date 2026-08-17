import { openai } from './openai'

/**
 * Genera preguntas frecuentes (Q&A) a partir del texto de un documento, con
 * gpt-4o-mini. Doble propósito: (1) mostrar en el panel el valor que aporta cada
 * fuente; (2) indexar las preguntas para mejorar la recuperación (los clientes
 * escriben preguntas). La respuesta se basa EXCLUSIVAMENTE en el documento — no
 * inventa — para preservar la regla "el bot nunca inventa".
 */

const MODEL = 'gpt-4o-mini'
const MAX_CHARS = 12_000 // tope de entrada para acotar costo
const MAX_QA = 20 // tope de preguntas por documento
const MIN_CHARS = 200 // contenido demasiado corto → no vale generar

export interface QaPair {
  question: string
  answer: string
}

export interface GenerateQaResult {
  pairs: QaPair[]
  /** true si el documento superaba MAX_CHARS y se generaron preguntas solo del
   *  inicio — el RAG normal (chunks) sí cubre el documento completo, pero las
   *  FAQ generadas no, sin que antes hubiera ningún aviso de eso. */
  truncated: boolean
}

const PROMPT = `Eres un analista de conocimiento. A partir ÚNICAMENTE del siguiente documento, genera las preguntas frecuentes que un cliente podría hacerle a la empresa y que ESTE documento permite responder, con su respuesta.

Reglas:
- La respuesta debe basarse EXCLUSIVAMENTE en el texto del documento. No inventes ni añadas datos externos. Si el documento no da para una respuesta clara, no incluyas esa pregunta.
- Preguntas naturales, como las haría un cliente real (precios, servicios, ubicación, proceso, requisitos, condiciones).
- Respuestas breves, en texto plano, español de Colombia. Sin Markdown.
- Máximo ${MAX_QA} pares. Prioriza lo más útil y consultado.

Devuelve SOLO un objeto JSON con esta forma:
{ "qa": [ { "question": "…", "answer": "…" } ] }
Si el documento no permite generar ninguna pregunta útil, devuelve { "qa": [] }.`

const safeJson = (s: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(s || '{}')
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function generateQa(content: string): Promise<GenerateQaResult> {
  const text = content.trim()
  if (text.length < MIN_CHARS) return { pairs: [], truncated: false }
  const truncated = text.length > MAX_CHARS

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: text.slice(0, MAX_CHARS) },
    ],
  })

  const parsed = safeJson(completion.choices[0]?.message?.content ?? '{}')
  const raw = Array.isArray(parsed.qa) ? parsed.qa : []

  const out: QaPair[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const q = (item as Record<string, unknown>).question
    const a = (item as Record<string, unknown>).answer
    if (typeof q === 'string' && typeof a === 'string' && q.trim() && a.trim()) {
      out.push({ question: q.trim(), answer: a.trim() })
    }
    if (out.length >= MAX_QA) break
  }
  return { pairs: out, truncated }
}
