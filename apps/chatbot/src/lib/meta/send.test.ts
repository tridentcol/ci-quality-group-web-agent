import { describe, expect, it } from 'vitest'
import { splitMessage } from './send'

describe('splitMessage', () => {
  it('texto corto → un solo trozo', () => {
    expect(splitMessage('hola', 100)).toEqual(['hola'])
  })

  it('divide texto largo en trozos ≤ límite', () => {
    const long = 'a'.repeat(250)
    const parts = splitMessage(long, 100)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.length <= 100)).toBe(true)
    expect(parts.join('')).toBe(long)
  })

  it('prefiere cortar en salto de línea o frase', () => {
    const text = 'Primera frase larga aquí.\n\nSegunda frase que sigue después.'
    const parts = splitMessage(text, 30)
    // el primer corte debería caer en el doble salto, no a mitad de palabra
    expect(parts[0]).toBe('Primera frase larga aquí.')
  })
})
