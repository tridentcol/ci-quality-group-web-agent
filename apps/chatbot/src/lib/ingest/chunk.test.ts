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
