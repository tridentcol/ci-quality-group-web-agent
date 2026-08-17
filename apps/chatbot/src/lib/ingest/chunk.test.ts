import { describe, expect, it } from 'vitest'
import { chunkText } from './chunk'

describe('chunkText', () => {
  it('texto vacío o en blanco → []', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('texto corto → un solo chunk (trim)', () => {
    const out = chunkText('Hola, esto es una prueba.')
    expect(out).toEqual(['Hola, esto es una prueba.'])
  })

  it('texto largo → varios chunks acotados al tamaño', () => {
    const maxTokens = 10 // 40 chars
    const paras = Array.from({ length: 8 }, (_, i) => `Parrafo numero ${i} con texto.`)
    const out = chunkText(paras.join('\n\n'), { maxTokens, overlapTokens: 2 })
    expect(out.length).toBeGreaterThan(1)
    // ningún chunk excede de forma exagerada el objetivo (40 chars + solapamiento)
    for (const c of out) expect(c.length).toBeLessThanOrEqual(40 * 2)
  })

  it('no parte un precio con formato colombiano ("$1.500.000") a la mitad', () => {
    // Un párrafo largo (sin doble salto de línea, como texto scrapeado de una
    // página) que obliga a partir por oración — el precio va cerca del límite
    // del chunk a propósito, para forzar el caso donde antes se rompía.
    const filler = 'Este es un texto de relleno para llenar el párrafo. '.repeat(6)
    const text = `${filler}El precio de la lámina es de $1.500.000 pesos por unidad. ${filler}`
    const out = chunkText(text, { maxTokens: 25, overlapTokens: 0 }) // 100 chars por chunk
    expect(out.some((c) => c.includes('$1.500.000'))).toBe(true)
    // tampoco debe quedar un fragmento roto del número en ALGÚN chunk
    for (const c of out) {
      expect(c).not.toMatch(/\$?\d{1,3}\.\s*$/) // no termina en "1." o "500." sueltos
    }
  })

  it('sigue partiendo por oración normal (el "." real de fin de frase no se pierde)', () => {
    const filler = 'Relleno de texto para forzar el corte por oración en este parrafo largo. '.repeat(4)
    const text = `${filler}Primera frase corta. Segunda frase corta. Tercera frase corta.`
    const out = chunkText(text, { maxTokens: 25, overlapTokens: 0 })
    expect(out.join(' ')).toContain('Primera frase corta.')
    expect(out.join(' ')).toContain('Tercera frase corta.')
  })

  it('aplica solapamiento entre chunks consecutivos', () => {
    const maxTokens = 10
    const overlapTokens = 3
    const paras = Array.from({ length: 6 }, (_, i) => `Bloque-${i} contenido textual aqui`)
    const out = chunkText(paras.join('\n\n'), { maxTokens, overlapTokens })
    expect(out.length).toBeGreaterThan(1)
    // el 2º chunk arranca con la cola del 1º (solapamiento)
    const head = out[1].slice(0, 5)
    expect(out[0]).toContain(head)
  })
})
