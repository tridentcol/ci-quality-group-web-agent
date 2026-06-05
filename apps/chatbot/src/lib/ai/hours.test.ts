import { describe, expect, it } from 'vitest'
import { isAfterHours, type BusinessHours } from './hours'

// L-V 07:00–17:00 (días 1..5)
const hours: BusinessHours = { days: [1, 2, 3, 4, 5], open: '07:00', close: '17:00' }

// Construye un instante UTC que corresponde a una hora de pared en Bogotá (UTC-5).
const bogota = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(Date.UTC(y, mo, d, h + 5, mi))

describe('isAfterHours', () => {
  it('sin horario → siempre abierto', () => {
    expect(isAfterHours(null, bogota(2026, 5, 3, 3))).toBe(false)
  })

  it('miércoles 10:00 → dentro de horario', () => {
    // 2026-06-03 es miércoles
    expect(isAfterHours(hours, bogota(2026, 5, 3, 10))).toBe(false)
  })

  it('miércoles 22:00 → fuera de horario', () => {
    expect(isAfterHours(hours, bogota(2026, 5, 3, 22))).toBe(true)
  })

  it('domingo a media tarde → fuera (no es día laboral)', () => {
    // 2026-06-07 es domingo
    expect(isAfterHours(hours, bogota(2026, 5, 7, 14))).toBe(true)
  })

  it('justo en la apertura (07:00) → abierto; en el cierre (17:00) → cerrado', () => {
    expect(isAfterHours(hours, bogota(2026, 5, 3, 7, 0))).toBe(false)
    expect(isAfterHours(hours, bogota(2026, 5, 3, 17, 0))).toBe(true)
  })
})
