/**
 * Corre el set de regresión (src/eval/cases.ts) contra el motor real en modo
 * dryRun (no crea leads/huecos ni cambia conversaciones). Verifica señales de
 * comportamiento e imprime pass/fail; sale 1 si algún caso falla.
 *
 * Uso: pnpm --filter chatbot eval   (necesita DATABASE_URL + OPENAI_API_KEY)
 */
import { generateReply } from '../src/lib/ai/generate'
import { cases, type EvalCase } from '../src/eval/cases'

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

function check(kase: EvalCase, res: Awaited<ReturnType<typeof generateReply>>): string[] {
  const fails: string[] = []
  const tools = res.toolCalls.map((t) => t.name)

  if (kase.expectAnyTool && !kase.expectAnyTool.some((t) => tools.includes(t))) {
    fails.push(`esperaba alguna de [${kase.expectAnyTool.join(', ')}], disparó [${tools.join(', ') || '—'}]`)
  }
  if (kase.expectNoTool) {
    const bad = kase.expectNoTool.filter((t) => tools.includes(t))
    if (bad.length) fails.push(`no debía disparar [${bad.join(', ')}]`)
  }
  if (kase.expectNoContext && res.contextUsed) {
    fails.push('esperaba SIN contexto pero recuperó fragmentos')
  }
  if (kase.replyMustNotInclude) {
    const hit = kase.replyMustNotInclude.filter((s) => res.reply.toLowerCase().includes(s.toLowerCase()))
    if (hit.length) fails.push(`la respuesta no debía incluir [${hit.join(', ')}]`)
  }
  // No basta con que la tool se haya LLAMADO: si sus args no cumplen lo esperado,
  // es tan fallo como si no se hubiera llamado (ver EvalCase.expectToolArgs).
  if (kase.expectToolArgs) {
    for (const expectation of kase.expectToolArgs) {
      const call = res.toolCalls.find((t) => t.name === expectation.tool)
      if (call && !expectation.check((call.args as Record<string, unknown>) ?? {})) {
        fails.push(`${expectation.tool} se llamó pero no cumple: ${expectation.description}`)
      }
    }
  }
  return fails
}

async function main() {
  console.log(c.bold(`\nSet de regresión — ${cases.length} casos\n`))
  let passed = 0

  for (const kase of cases) {
    try {
      const res = await generateReply({ message: kase.message, mode: 'eval' })
      const fails = check(kase, res)
      const tools = res.toolCalls.map((t) => t.name).join(', ') || '—'
      if (fails.length === 0) {
        passed++
        console.log(`${c.green('✓')} ${kase.name}  ${c.dim(`(tools: ${tools})`)}`)
      } else {
        console.log(`${c.red('✗')} ${kase.name}`)
        for (const f of fails) console.log(`   ${c.red('·')} ${f}`)
        console.log(c.dim(`   respuesta: ${res.reply.slice(0, 120)}…`))
      }
    } catch (e) {
      console.log(`${c.red('✗')} ${kase.name}`)
      console.log(`   ${c.red('·')} error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const failed = cases.length - passed
  console.log(c.bold(`\n${passed}/${cases.length} casos en verde${failed ? c.red(` · ${failed} fallaron`) : ''}\n`))
  process.exit(failed ? 1 : 0)
}

main()
