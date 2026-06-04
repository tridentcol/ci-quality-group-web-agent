import { describe, expect, it } from 'vitest'
import { resolveLookup, type MaterialRow } from './pricing'

const cobre: MaterialRow = {
  name: 'Cobre #1',
  active: true,
  unit: 'kg',
  retailPriceCop: '28000',
  wholesalePriceCop: '26000',
  wholesaleThreshold: '100',
}

describe('resolveLookup', () => {
  it('sin cantidad → precio minorista', () => {
    const r = resolveLookup([cobre], { material: 'Cobre #1' })
    expect(r).toMatchObject({ available: true, tier: 'retail', unitPriceCop: 28000 })
  })

  it('cantidad por debajo del umbral → minorista con total', () => {
    const r = resolveLookup([cobre], { material: 'Cobre #1', quantity: 50 })
    expect(r).toMatchObject({ tier: 'retail', unitPriceCop: 28000, quantity: 50, totalCop: 28000 * 50 })
  })

  it('cantidad ≥ umbral → precio mayorista', () => {
    const r = resolveLookup([cobre], { material: 'Cobre #1', quantity: 150 })
    expect(r).toMatchObject({ tier: 'wholesale', unitPriceCop: 26000, totalCop: 26000 * 150 })
  })

  it('cantidad ≥ umbral pero sin precio mayorista → minorista', () => {
    const soloRetail: MaterialRow = { ...cobre, wholesalePriceCop: null, wholesaleThreshold: null }
    const r = resolveLookup([soloRetail], { material: 'Cobre #1', quantity: 999 })
    expect(r).toMatchObject({ tier: 'retail', unitPriceCop: 28000 })
  })

  it('material inactivo → no disponible (inactive)', () => {
    const r = resolveLookup([{ ...cobre, active: false }], { material: 'Cobre #1' })
    expect(r).toEqual({ available: false, reason: 'inactive', material: 'Cobre #1' })
  })

  it('sin coincidencias → no disponible (not_found)', () => {
    const r = resolveLookup([], { material: 'No existe' })
    expect(r).toEqual({ available: false, reason: 'not_found', material: 'No existe' })
  })

  it('prefiere la coincidencia exacta (case-insensitive) sobre la primera', () => {
    const otro: MaterialRow = { ...cobre, name: 'Cobre #1 chatarra', retailPriceCop: '5000' }
    const r = resolveLookup([otro, cobre], { material: 'cobre #1' })
    expect(r).toMatchObject({ available: true, material: 'Cobre #1', unitPriceCop: 28000 })
  })
})
