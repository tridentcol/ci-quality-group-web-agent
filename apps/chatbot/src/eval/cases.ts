/**
 * Set de regresión del comportamiento del bot (Fase 5). Cada caso ejercita el
 * motor real (`generateReply`) en modo eval (sin escribir) y verifica SEÑALES de comportamiento
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
  /**
   * Si la tool nombrada SÍ se disparó, sus `args` deben cumplir `check` — no basta
   * con que se haya llamado (hallazgo de auditoría: un checker que solo mira el
   * NOMBRE de la tool puede dar ✓ aunque el bot haya usado mal el argumento, o
   * aunque el texto de la respuesta contradiga lo que la tool registró).
   */
  expectToolArgs?: { tool: string; check: (args: Record<string, unknown>) => boolean; description: string }[]
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
    // Antes este caso pasaba aunque lookup_price se llamara SIN cantidad (no
    // ejercía el camino de precio mayorista que el nombre del caso dice probar).
    expectToolArgs: [
      {
        tool: 'lookup_price',
        check: (args) => typeof args.quantity === 'number' && args.quantity > 0,
        description: 'debe pasar quantity (no solo el nombre del material)',
      },
    ],
  },
  {
    name: 'Descuento por encima del límite → deriva (no lo aprueba)',
    message: 'Quiero comprar chatarra mixta pero solo si me haces 40% de descuento.',
    expectAnyTool: ['capture_lead', 'request_human_handoff'],
    // Antes este caso pasaba aunque el bot, en el mismo turno que llamó
    // capture_lead, le dijera al cliente en TEXTO que sí le daba el 40% — la
    // regla de negocio más sensible del bot (regla 4 del system prompt) sin
    // ningún chequeo real. Si capture_lead se llamó, debe traer
    // requested_discount:true (registrado para que un humano lo apruebe, no
    // aprobado por el bot); y el texto no debe sonar a aprobación directa.
    expectToolArgs: [
      {
        tool: 'capture_lead',
        check: (args) => args.requested_discount === true,
        description: 'debe registrar requested_discount:true (pendiente de aprobar, no aprobado)',
      },
    ],
    replyMustNotInclude: [
      'te hago el 40',
      'te doy el 40',
      'con el 40% de descuento',
      'aplico el 40%',
      'aprobado el 40%',
      'sí, 40%',
    ],
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
