import { describe, expect, it } from 'vitest'
import { stripStrayMarkdown } from './sanitize'

describe('stripStrayMarkdown', () => {
  it('quita negrita con doble asterisco', () => {
    expect(stripStrayMarkdown('El precio es **28.000 COP** por kg')).toBe('El precio es 28.000 COP por kg')
  })

  it('quita negrita con doble guion bajo', () => {
    expect(stripStrayMarkdown('__Cobre #1__: 28.000 COP')).toBe('Cobre #1: 28.000 COP')
  })

  it('quita cursiva con un asterisco', () => {
    expect(stripStrayMarkdown('Precio *especial* hoy')).toBe('Precio especial hoy')
  })

  it('quita cursiva con un guion bajo', () => {
    expect(stripStrayMarkdown('Precio _especial_ hoy')).toBe('Precio especial hoy')
  })

  it('quita encabezados markdown al inicio de línea', () => {
    expect(stripStrayMarkdown('# Materiales disponibles')).toBe('Materiales disponibles')
  })

  it('no toca texto plano normal', () => {
    const t = 'El precio del cobre es de 28.000 COP por kg (mayorista 30.000 desde 100 kg).'
    expect(stripStrayMarkdown(t)).toBe(t)
  })

  it('no rompe viñetas con "•" (no es markdown)', () => {
    const t = 'Ofrecemos:\n\n• Cobre: 28.000 COP\n• Aluminio: 6.500 COP'
    expect(stripStrayMarkdown(t)).toBe(t)
  })

  it('no rompe un precio con "#" que no sea encabezado (ej. Cobre #1)', () => {
    const t = 'Cobre #1: 28.000 COP por kg'
    expect(stripStrayMarkdown(t)).toBe(t)
  })

  it('maneja varias negritas en el mismo texto', () => {
    expect(stripStrayMarkdown('**Cobre #1**: 28.000 COP, **Aluminio**: 6.500 COP')).toBe(
      'Cobre #1: 28.000 COP, Aluminio: 6.500 COP',
    )
  })
})
