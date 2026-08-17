import { describe, expect, it } from 'vitest'
import { subtractMonths } from './date-utils'

// new Date(y, m, d) construye en hora LOCAL — igual que subtractMonths (usa
// getDate/setMonth, no las variantes UTC) — así el test no depende de la zona
// horaria del runner.
describe('subtractMonths', () => {
  it('caso normal: no cambia el día', () => {
    const r = subtractMonths(new Date(2026, 7, 17), 6) // 17-ago-2026
    expect(r.getFullYear()).toBe(2026)
    expect(r.getMonth()).toBe(1) // febrero (0-index)
    expect(r.getDate()).toBe(17)
  })

  it('evita el rebote de setMonth: 31-ago menos 6 meses → 28-feb (no 3-mar)', () => {
    const r = subtractMonths(new Date(2026, 7, 31), 6) // 31-ago-2026 (no bisiesto)
    expect(r.getMonth()).toBe(1) // febrero, NO marzo
    expect(r.getDate()).toBe(28)
  })

  it('respeta año bisiesto: 31-ago menos 6 meses en año bisiesto → 29-feb', () => {
    const r = subtractMonths(new Date(2028, 7, 31), 6)
    expect(r.getMonth()).toBe(1)
    expect(r.getDate()).toBe(29)
  })

  it('cruza de año correctamente', () => {
    const r = subtractMonths(new Date(2026, 0, 15), 2) // 15-ene-2026
    expect(r.getFullYear()).toBe(2025)
    expect(r.getMonth()).toBe(10) // noviembre
    expect(r.getDate()).toBe(15)
  })

  it('31-mar menos 1 mes → 28-feb (no 3-mar)', () => {
    const r = subtractMonths(new Date(2026, 2, 31), 1) // 31-mar-2026
    expect(r.getMonth()).toBe(1)
    expect(r.getDate()).toBe(28)
  })
})
