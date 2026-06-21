/**
 * Set de regresión del comportamiento del bot (Fase 5). Cada caso ejercita el
 * motor real (`generateReply`) en modo dryRun y verifica SEÑALES de comportamiento
 * —qué herramientas dispara, si usó contexto— no la redacción exacta (que varía).
 * Sirve para detectar regresiones tras cambiar prompts, router, tools o RAG.
 *
 * Correr: `pnpm --filter chatbot eval` (necesita DATABASE_URL + OPENAI_API_KEY).
 */

export interface EvalCase {
  name: string
  message: string
  /** Debe dispararse AL MENOS una de estas tools. */
  expectAnyTool?: string[]
  /** Ninguna de estas tools debe dispararse. */
  expectNoTool?: string[]
  /** Exigir que NO se haya recuperado contexto (pregunta fuera de dominio). */
  expectNoContext?: boolean
  /** La respuesta NO debe contener estos textos (p. ej. precios inventados). */
  replyMustNotInclude?: string[]
}

export const cases: EvalCase[] = [
  {
    name: 'Precio de un material → usa lookup_price (no inventa)',
    message: '¿A cómo me pagan el cobre #1 por kilo?',
    expectAnyTool: ['lookup_price'],
  },
  {
    name: 'Precio por volumen → usa lookup_price con cantidad',
    message: 'Tengo 500 kilos de aluminio perfil para vender, ¿cuánto me dan?',
    expectAnyTool: ['lookup_price'],
  },
  {
    name: 'Descuento por encima del límite → deriva (no lo aprueba)',
    message: 'Quiero comprar chatarra mixta pero solo si me haces 40% de descuento.',
    expectAnyTool: ['capture_lead', 'request_human_handoff'],
  },
  {
    name: 'Intención de venta → captura lead',
    message: 'Soy Juan, quiero vender 2 toneladas de bronce, mi número es 3001234567.',
    expectAnyTool: ['capture_lead'],
  },
  {
    name: 'Pregunta general de precios → lista materiales (no deriva)',
    message: '¿sobre cuáles materiales me puedes dar precios?',
    expectAnyTool: ['list_materials'],
  },
  {
    name: 'Ubicación → usa get_location',
    message: '¿Dónde están ubicados? ¿A qué dirección llevo el material?',
    expectAnyTool: ['get_location'],
  },
  {
    name: 'Pregunta fuera de dominio → no inventa, deriva/registra hueco',
    message: '¿Cuál es la capital de Francia?',
    expectNoContext: true,
    expectNoTool: ['lookup_price'],
  },
]
