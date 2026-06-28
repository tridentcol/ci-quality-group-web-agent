/**
 * Horario de atención (bot_config.business_hours) en zona America/Bogota.
 * Puro y testeable: decide si un instante cae FUERA del horario configurado.
 * Soporta horario POR DÍA (cada día su propio open/close, o cerrado) y FERIADOS.
 */

export interface DayHours {
  open: string // "HH:MM"
  close: string // "HH:MM"
}

export interface BusinessHours {
  /** Horario por día; índice 0=domingo … 6=sábado. null = cerrado ese día. */
  schedule: (DayHours | null)[]
  /** Fechas cerradas (feriados), formato "YYYY-MM-DD" en zona Bogotá. */
  holidays?: string[]
}

// Forma antigua (un único open/close para los días marcados).
interface LegacyHours {
  days: number[]
  open: string
  close: string
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Normaliza la forma nueva o la antigua a `BusinessHours`. Desconocido → null. */
export function normalizeHours(raw: unknown): BusinessHours | null {
  if (!raw || typeof raw !== 'object') return null
  const h = raw as Partial<BusinessHours> & Partial<LegacyHours>
  if (Array.isArray(h.schedule)) {
    return { schedule: h.schedule, holidays: h.holidays ?? [] }
  }
  // Compat: { days:[...], open, close } → schedule por día.
  if (Array.isArray(h.days) && h.open && h.close) {
    const schedule = Array.from({ length: 7 }, (_, d) =>
      h.days!.includes(d) ? { open: h.open!, close: h.close! } : null,
    )
    return { schedule, holidays: [] }
  }
  return null
}

/** Partes (fecha/día/minutos) de un instante en zona Bogotá. */
function bogotaDateParts(now: Date): { date: string; day: number; minutes: number } {
  const b = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = b.getFullYear()
  const m = String(b.getMonth() + 1).padStart(2, '0')
  const d = String(b.getDate()).padStart(2, '0')
  return { date: `${y}-${m}-${d}`, day: b.getDay(), minutes: b.getHours() * 60 + b.getMinutes() }
}

/**
 * ¿El instante `now` cae fuera del horario? Sin horario configurado → siempre
 * abierto (false). Cierra en feriados y en días sin horario. Colombia no tiene DST.
 */
export function isAfterHours(hoursRaw: unknown, now: Date = new Date()): boolean {
  const hours = normalizeHours(hoursRaw)
  if (!hours) return false

  const { date, day, minutes } = bogotaDateParts(now)
  if (hours.holidays?.includes(date)) return true

  const sched = hours.schedule[day]
  if (!sched || !sched.open || !sched.close) return true

  const open = minutes >= toMinutes(sched.open) && minutes < toMinutes(sched.close)
  return !open
}
