/**
 * Lógica pura de precios (Step 8/14) — sin acceso a BD para poder testearla.
 * `lookup_price` (tools.ts) trae las filas de `materials` y delega aquí la
 * selección del material (por nombre Y categoría, tolerante a frases/plurales) y
 * el cálculo minorista/mayorista por umbral.
 */

export interface MaterialRow {
  name: string
  category?: string | null
  active: boolean
  unit: string
  retailPriceCop: string
  wholesalePriceCop: string | null
  wholesaleThreshold: string | null
}

export type LookupPriceResult =
  | { available: false; reason: 'not_found' | 'inactive'; material: string }
  | {
      available: true
      material: string
      unit: string
      tier: 'retail' | 'wholesale'
      unitPriceCop: number
      // Panorama completo de precios para que el bot pueda explicar el mayoreo y
      // responder "desde cuánto aplica" SIN inventar (umbral/precio mayorista).
      retailPriceCop: number
      wholesalePriceCop: number | null
      wholesaleThreshold: number | null
      quantity?: number
      totalCop?: number
    }

const num = (v: string | null | undefined) => (v == null ? null : Number(v))

// Normaliza para comparar: sin acentos, minúsculas, espacios colapsados.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Tokens significativos (≥3 letras/números) de un texto normalizado.
function tokens(s: string): string[] {
  return s.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
}

// Dos tokens coinciden si son iguales o uno contiene al otro (plurales/sufijos:
// "laminas" ~ "lamina"), exigiendo longitud ≥4 para el modo "contiene".
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true
  return false
}

/**
 * Puntúa qué tan bien encaja un material con la consulta. Prioriza nombre exacto,
 * luego nombre contenido en la consulta (o viceversa), luego solape de tokens en
 * nombre y, con menos peso, en la categoría. 0 = no encaja.
 */
function scoreMaterial(m: MaterialRow, nQuery: string, qTokens: string[]): number {
  const nName = normalize(m.name)
  if (nName === nQuery) return 1000

  let score = 0
  if (nName && (nQuery.includes(nName) || nName.includes(nQuery))) score += 100

  const nameTokens = tokens(nName)
  const catTokens = tokens(normalize(m.category ?? ''))
  for (const qt of qTokens) {
    if (nameTokens.some((t) => tokenMatch(t, qt))) score += 10
    else if (catTokens.some((t) => tokenMatch(t, qt))) score += 5
  }
  return score
}

/**
 * Selecciona el material que mejor coincide con `args.material` (que puede venir
 * como una frase, p. ej. "láminas tipo kingspan") y resuelve precio/umbral.
 */
export function resolveLookup(
  rows: MaterialRow[],
  args: { material: string; quantity?: number },
): LookupPriceResult {
  const q = args.material.trim()
  const nQuery = normalize(q)
  const qTokens = tokens(nQuery)

  const ranked = rows
    .map((r) => ({ r, s: scoreMaterial(r, nQuery, qTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)

  if (ranked.length === 0) return { available: false, reason: 'not_found', material: q }

  const m = ranked[0].r
  if (!m.active) return { available: false, reason: 'inactive', material: m.name }

  const retail = Number(m.retailPriceCop)
  const wholesale = num(m.wholesalePriceCop)
  const threshold = num(m.wholesaleThreshold)

  const useWholesale =
    args.quantity != null && wholesale != null && threshold != null && args.quantity >= threshold

  const unitPriceCop = useWholesale ? wholesale! : retail
  const tier: 'retail' | 'wholesale' = useWholesale ? 'wholesale' : 'retail'

  return {
    available: true,
    material: m.name,
    unit: m.unit,
    tier,
    unitPriceCop,
    retailPriceCop: retail,
    wholesalePriceCop: wholesale,
    wholesaleThreshold: threshold,
    ...(args.quantity != null
      ? { quantity: args.quantity, totalCop: unitPriceCop * args.quantity }
      : {}),
  }
}
