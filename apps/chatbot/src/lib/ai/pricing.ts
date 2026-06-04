/**
 * Lógica pura de precios (Step 8/14) — sin acceso a BD para poder testearla.
 * `lookup_price` (tools.ts) recupera las filas de `materials` y delega aquí la
 * selección de material y el cálculo minorista/mayorista por umbral.
 */

export interface MaterialRow {
  name: string
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
      quantity?: number
      totalCop?: number
    }

const num = (v: string | null | undefined) => (v == null ? null : Number(v))

/**
 * Decide disponibilidad y precio a partir de las filas que coinciden con el
 * nombre buscado. Prefiere coincidencia exacta (case-insensitive); aplica
 * precio mayorista solo si hay cantidad, precio y umbral, y cantidad ≥ umbral.
 */
export function resolveLookup(
  rows: MaterialRow[],
  args: { material: string; quantity?: number },
): LookupPriceResult {
  const q = args.material.trim()
  if (rows.length === 0) return { available: false, reason: 'not_found', material: q }

  const exact = rows.find((r) => r.name.toLowerCase() === q.toLowerCase())
  const m = exact ?? rows[0]

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
    ...(args.quantity != null
      ? { quantity: args.quantity, totalCop: unitPriceCop * args.quantity }
      : {}),
  }
}
