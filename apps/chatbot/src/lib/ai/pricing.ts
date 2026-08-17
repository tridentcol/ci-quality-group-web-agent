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
  // Segundo escalón mayorista (volumen mayor): precio + umbral.
  wholesalePrice2Cop?: string | null
  wholesaleThreshold2?: string | null
  // Cantidad mínima para operar este material (en su unidad).
  minOrder?: string | null
  // Medio fijo vinculado al material (foto/clip), si lo tiene.
  mediaUrl?: string | null
  mediaType?: 'image' | 'video' | null
}

export type LookupPriceResult =
  | { available: false; reason: 'not_found' | 'inactive'; material: string }
  | {
      available: true
      material: string
      unit: string
      tier: 'retail' | 'wholesale' | 'wholesale2'
      unitPriceCop: number
      // Panorama completo de precios para que el bot pueda explicar el mayoreo y
      // responder "desde cuánto aplica" SIN inventar (umbral/precio mayorista).
      retailPriceCop: number
      wholesalePriceCop: number | null
      wholesaleThreshold: number | null
      wholesalePrice2Cop: number | null
      wholesaleThreshold2: number | null
      minOrder: number | null
      quantity?: number
      totalCop?: number
      // Medio fijo del material (para adjuntarlo de forma determinista).
      mediaUrl?: string | null
      mediaType?: 'image' | 'video' | null
      // 'name' = el nombre del material coincide con lo que pidió el cliente (exacto,
      // contenido, o comparte alguna palabra). 'category' = SOLO coincide la categoría
      // (ej. preguntó "lámina arquitectónica", que no existe, y esto devuelve la teja
      // trapezoidal por compartir categoría "lámina") — el bot debe aclarar que es una
      // aproximación, no el producto exacto (ver regla 14 del system prompt).
      matchedBy: 'name' | 'category'
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
 * nombre y, con menos peso, en la categoría. 0 = no encaja. `nameMatched` indica si
 * hubo ALGÚN acierto a nivel de nombre (no solo categoría) — se lo llevamos al
 * resultado (`matchedBy`) para que el bot no confirme como exacto un match que en
 * realidad solo comparte categoría (ej. "lámina arquitectónica" ≠ "teja trapezoidal").
 */
function scoreMaterial(m: MaterialRow, nQuery: string, qTokens: string[]): { score: number; nameMatched: boolean } {
  const nName = normalize(m.name)
  if (nName === nQuery) return { score: 1000, nameMatched: true }

  let score = 0
  let nameMatched = false
  if (nName && (nQuery.includes(nName) || nName.includes(nQuery))) {
    score += 100
    nameMatched = true
  }

  const nameTokens = tokens(nName)
  const catTokens = tokens(normalize(m.category ?? ''))
  for (const qt of qTokens) {
    if (nameTokens.some((t) => tokenMatch(t, qt))) {
      score += 10
      nameMatched = true
    } else if (catTokens.some((t) => tokenMatch(t, qt))) {
      score += 5
    }
  }
  return { score, nameMatched }
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
    .map((r) => ({ r, ...scoreMaterial(r, nQuery, qTokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return { available: false, reason: 'not_found', material: q }

  const top = ranked[0]
  const m = top.r
  if (!m.active) return { available: false, reason: 'inactive', material: m.name }

  const retail = Number(m.retailPriceCop)
  const wholesale = num(m.wholesalePriceCop)
  const threshold = num(m.wholesaleThreshold)
  const wholesale2 = num(m.wholesalePrice2Cop)
  const threshold2 = num(m.wholesaleThreshold2)
  const minOrder = num(m.minOrder)

  // Escalón aplicable según la cantidad. Se evalúa del volumen mayor al menor para
  // dar el mejor precio. Cada escalón requiere SU precio Y SU umbral. Un umbral de
  // 0 (o negativo) no es un umbral real: suele venir de un campo dejado en blanco
  // que se guardó como 0 en vez de null (dato mal cargado) — se ignora ese escalón
  // para no regalar el material o inventar un precio mayorista falso de $0.
  const qty = args.quantity ?? null
  let unitPriceCop = retail
  let tier: 'retail' | 'wholesale' | 'wholesale2' = 'retail'
  if (qty != null) {
    if (wholesale2 != null && threshold2 != null && threshold2 > 0 && qty >= threshold2) {
      unitPriceCop = wholesale2
      tier = 'wholesale2'
    } else if (wholesale != null && threshold != null && threshold > 0 && qty >= threshold) {
      unitPriceCop = wholesale
      tier = 'wholesale'
    }
  }

  return {
    available: true,
    material: m.name,
    unit: m.unit,
    tier,
    unitPriceCop,
    retailPriceCop: retail,
    wholesalePriceCop: wholesale,
    wholesaleThreshold: threshold,
    wholesalePrice2Cop: wholesale2,
    wholesaleThreshold2: threshold2,
    minOrder,
    mediaUrl: m.mediaUrl ?? null,
    mediaType: m.mediaType ?? null,
    matchedBy: top.nameMatched ? 'name' : 'category',
    ...(qty != null ? { quantity: qty, totalCop: unitPriceCop * qty } : {}),
  }
}
