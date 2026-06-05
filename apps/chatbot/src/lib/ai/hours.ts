/**
 * Horario de atención (bot_config.business_hours) en zona America/Bogota.
 * Puro y testeable: decide si un instante cae FUERA del horario configurado.
 */

export interface BusinessHours {
  /** Días abiertos: 0=domingo … 6=sábado. */
  days: number[]
  /** Apertura "HH:MM". */
  open: string
  /** Cierre "HH:MM". */
  close: string
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * ¿El instante `now` cae fuera del horario? Sin horario configurado → siempre
 * abierto (false). La hora/día se evalúan en America/Bogota (Colombia no tiene DST).
 */
export function isAfterHours(
  hours: BusinessHours | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!hours || !hours.days?.length || !hours.open || !hours.close) return false

  // Hora de pared en Bogotá: re-parsear el string localizado da los números de
  // Bogotá independientemente de la zona del servidor.
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const day = bogota.getDay()
  const mins = bogota.getHours() * 60 + bogota.getMinutes()

  const openMin = toMinutes(hours.open)
  const closeMin = toMinutes(hours.close)

  const open = hours.days.includes(day) && mins >= openMin && mins < closeMin
  return !open
}
