import { generateReply } from './generate'

/**
 * Escenarios de prueba editables desde el panel. Un escenario es una conversación
 * (turnos del cliente) + lo que se espera del bot en el ÚLTIMO turno. Se corre en
 * modo 'eval' (no escribe leads/huecos ni toca conversaciones). Misma idea que la
 * batería `eval` del repo, pero no-code.
 */
export interface ScenarioExpectations {
  /** Debe dispararse AL MENOS una de estas tools en el último turno. */
  expectTools?: string[]
  /** Ninguna de estas tools debe dispararse. */
  forbidTools?: string[]
  /** Exigencia sobre el contexto recuperado por RAG. */
  expectContext?: 'any' | 'with' | 'without'
  /** La respuesta debe contener este texto (sin distinguir mayúsculas). */
  replyIncludes?: string
  /** La respuesta NO debe contener este texto. */
  replyExcludes?: string
}

export interface ScenarioRunResult {
  pass: boolean
  details: string[]
  reply: string
  tools: string[]
  contextUsed: boolean
}

export async function runScenario(
  messages: string[],
  exp: ScenarioExpectations,
): Promise<ScenarioRunResult> {
  const history: { role: 'user' | 'assistant'; content: string }[] = []
  let last: Awaited<ReturnType<typeof generateReply>> | undefined

  for (const msg of messages) {
    if (!msg.trim()) continue
    last = await generateReply({ message: msg, history, mode: 'eval' })
    history.push({ role: 'user', content: msg }, { role: 'assistant', content: last.reply })
  }

  if (!last) {
    return { pass: false, details: ['El escenario no tiene mensajes.'], reply: '', tools: [], contextUsed: false }
  }

  const tools = last.toolCalls.map((t) => t.name)
  const fails: string[] = []

  if (exp.expectTools?.length && !exp.expectTools.some((t) => tools.includes(t))) {
    fails.push(`esperaba alguna de [${exp.expectTools.join(', ')}], disparó [${tools.join(', ') || '—'}]`)
  }
  if (exp.forbidTools?.length) {
    const bad = exp.forbidTools.filter((t) => tools.includes(t))
    if (bad.length) fails.push(`no debía disparar [${bad.join(', ')}]`)
  }
  if (exp.expectContext === 'with' && !last.contextUsed) fails.push('esperaba contexto pero no recuperó nada')
  if (exp.expectContext === 'without' && last.contextUsed) fails.push('esperaba SIN contexto pero recuperó fragmentos')
  if (exp.replyIncludes && !last.reply.toLowerCase().includes(exp.replyIncludes.toLowerCase())) {
    fails.push(`la respuesta no incluye "${exp.replyIncludes}"`)
  }
  if (exp.replyExcludes && last.reply.toLowerCase().includes(exp.replyExcludes.toLowerCase())) {
    fails.push(`la respuesta no debía incluir "${exp.replyExcludes}"`)
  }

  return { pass: fails.length === 0, details: fails, reply: last.reply, tools, contextUsed: last.contextUsed }
}
