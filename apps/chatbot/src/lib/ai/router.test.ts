import { describe, expect, it } from 'vitest'
import { selectModel, MODEL_DEFAULT, MODEL_ESCALATED } from './router'

describe('selectModel', () => {
  it('consulta simple con buen contexto → mini', () => {
    expect(selectModel({ message: '¿Cuánto cuesta el cobre?', contextFound: true, topSimilarity: 0.8 }).model).toBe(MODEL_DEFAULT)
  })

  it('mensaje largo → gpt-4o', () => {
    const message = 'a'.repeat(300)
    expect(selectModel({ message, contextFound: true, topSimilarity: 0.8 }).model).toBe(MODEL_ESCALATED)
  })

  it('tecnicismo del dominio → gpt-4o', () => {
    expect(selectModel({ message: '¿Cumplen la normativa ambiental?', contextFound: true, topSimilarity: 0.8 }).model).toBe(MODEL_ESCALATED)
  })

  it('sin contexto RAG → gpt-4o', () => {
    expect(selectModel({ message: 'hola', contextFound: false }).model).toBe(MODEL_ESCALATED)
  })

  it('similitud baja → gpt-4o', () => {
    expect(selectModel({ message: 'algo', contextFound: true, topSimilarity: 0.1 }).model).toBe(MODEL_ESCALATED)
  })
})
