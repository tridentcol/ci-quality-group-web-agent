/**
 * Router de modelo (blueprint §9 Step 9): heurística barata para escalar de
 * GPT-4o-mini (default, ~90% de las dudas) a GPT-4o solo cuando hace falta —
 * por longitud, tecnicismo o fallo de RAG. Sin llamadas a la API.
 */

export const MODEL_DEFAULT = 'gpt-4o-mini'
export const MODEL_ESCALATED = 'gpt-4o'

export interface RouterInput {
  message: string
  /** ¿Hubo chunks recuperados por RAG por encima del umbral? */
  contextFound: boolean
  /** Mejor similitud coseno recuperada [0..1], si la hay. */
  topSimilarity?: number
}

export interface RouterDecision {
  model: typeof MODEL_DEFAULT | typeof MODEL_ESCALATED
  reason: string
}

// Tecnicismos del dominio (chatarra/ambiental/legal) que suelen requerir más razonamiento.
const TECHNICAL_TERMS = [
  'normativ',
  'ambiental',
  'certificad',
  'resolución',
  'decreto',
  'ley ',
  'aduan',
  'exportac',
  'importac',
  'aleaci',
  'fundici',
  'densidad',
  'tonelaj',
  'rut',
  'factura',
  'iva',
  'retención',
  'cancelación de matrícula',
  'siniestr',
  'peritaje',
  'desintegrac',
  // Specs técnicas (calibre/dimensiones): el bot solo puede darlas si están en el
  // contexto RAG, nunca inventarlas — escalar a un modelo más confiable con las
  // reglas de la tool y el guardarraíl anti-alucinación.
  'calibre',
  'espesor',
  'grosor',
  'dimensi',
  'medidas',
  // Agendamiento (recogidas/entregas/citas): requiere cruzar la fecha de hoy
  // contra el horario configurado sin inventar días ni horas — se vio fallar
  // en gpt-4o-mini (proponía días cerrados y hasta cambiaba el horario real).
  'agend',
  'recog',
  'horario',
  'cita',
  'cuando puedo',
  'que dia',
  'qué día',
  // Descuentos: capture_lead(requested_discount) debe llamarse SIEMPRE que piden
  // más del máximo permitido — se vio a gpt-4o-mini saltárselo inconsistentemente
  // (a veces ni registraba el lead, solo preguntaba "¿quieres que lo registre?").
  'descuent',
  'rebaj',
]

const LONG_CHARS = 280
const LONG_WORDS = 60
const LOW_SIMILARITY = 0.35

export function selectModel(i: RouterInput): RouterDecision {
  const text = i.message.toLowerCase()

  if (i.message.length > LONG_CHARS || i.message.split(/\s+/).length > LONG_WORDS) {
    return { model: MODEL_ESCALATED, reason: 'mensaje largo' }
  }

  const term = TECHNICAL_TERMS.find((t) => text.includes(t))
  if (term) return { model: MODEL_ESCALATED, reason: `tecnicismo ("${term.trim()}")` }

  if (!i.contextFound) return { model: MODEL_ESCALATED, reason: 'sin contexto RAG' }

  if (i.topSimilarity != null && i.topSimilarity < LOW_SIMILARITY) {
    return { model: MODEL_ESCALATED, reason: `RAG débil (${i.topSimilarity.toFixed(2)})` }
  }

  return { model: MODEL_DEFAULT, reason: 'consulta simple con contexto' }
}
