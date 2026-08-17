/**
 * Utilidades de fecha puras (sin BD) para poder testearlas — mismo criterio que
 * `src/lib/ai/pricing.ts`/`hours.ts`.
 */

/**
 * Resta `months` meses a `date` sin el "rebote" de `Date.setMonth()`: si el mes
 * destino tiene menos días que el día actual (ej. 31-ago menos 6 meses → "31-feb",
 * que no existe), `setMonth` normaliza al mes SIGUIENTE (~3-mar) — eso adelantaría
 * un cutoff de retención unos días y borraría datos que técnicamente aún no
 * vencieron. Fijamos el día en 1 antes de mover el mes (evita el rebote) y luego
 * restauramos el día original, recortado al último día válido del mes resultante.
 */
export function subtractMonths(date: Date, months: number): Date {
  const day = date.getDate()
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTargetMonth))
  return d
}
