/**
 * Banco de pruebas conversacional (sin Meta). REPL que ejercita el pipeline real
 * del bot —memoria de corto plazo + RAG + router + generación + tools— contra la
 * BD y OpenAI, igual que el webhook pero en la terminal. Sirve para afinar tono,
 * conocimiento (RAG) y comportamiento ANTES de conectar los canales.
 *
 * Uso:
 *   pnpm --filter chatbot chat                 # canal whatsapp, id "banco-de-pruebas"
 *   pnpm --filter chatbot chat -- --reset      # borra la conversación de prueba y arranca limpio
 *   pnpm --filter chatbot chat -- --channel instagram --id juan
 *
 * Necesita DATABASE_URL + OPENAI_API_KEY en .env.local.
 *
 * Comandos dentro del chat:
 *   /help            lista de comandos
 *   /rag <texto>     muestra los chunks que recupera el RAG (con score) — para ver si hay cobertura
 *   /mem             memoria actual (perfil/resumen/estado/nº de turnos)
 *   /reset           borra ESTA conversación de prueba y su perfil (empieza de cero)
 *   /whoami          canal · externalId · conversationId
 *   /quit            salir (también Ctrl-C)
 */
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { and, eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { conversations, customerProfiles, messages } from '../src/lib/db/schema'
import { loadMemory, appendMessage } from '../src/lib/ai/memory'
import { generateReply } from '../src/lib/ai/generate'
import { retrieve } from '../src/lib/ai/retrieve'

// ── Colores mínimos (sin dependencias) ──────────────────────────────────────
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
}

// ── Args ─────────────────────────────────────────────────────────────────────
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const CHANNEL = arg('channel', 'whatsapp')
const EXTERNAL_ID = arg('id', 'banco-de-pruebas')
const DO_RESET = process.argv.includes('--reset')

async function resetConversation() {
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.channel, CHANNEL), eq(conversations.externalId, EXTERNAL_ID)))
  if (conv) {
    await db.delete(messages).where(eq(messages.conversationId, conv.id))
    await db.delete(conversations).where(eq(conversations.id, conv.id))
  }
  await db
    .delete(customerProfiles)
    .where(and(eq(customerProfiles.channel, CHANNEL), eq(customerProfiles.externalId, EXTERNAL_ID)))
}

function printDiagnostics(res: Awaited<ReturnType<typeof generateReply>>) {
  const ctx = res.contextUsed ? c.green('sí') : c.red('NO (sin contexto RAG)')
  console.log(
    c.dim(`   ↳ modelo=${res.model} · router=${res.routerReason} · contexto=${ctx}`),
  )
  for (const t of res.toolCalls) {
    const args = JSON.stringify(t.args)
    let resumen = ''
    const r = t.result as Record<string, unknown> | null
    if (r && typeof r === 'object') {
      if ('available' in r) resumen = r.available ? `tier=${r.tier} precio=${r.unitPriceCop}` : 'no disponible'
      else if ('error' in r) resumen = `error: ${r.error}`
      else resumen = JSON.stringify(r).slice(0, 120)
    }
    console.log(c.yellow(`   🔧 ${t.name}(${args})`) + (resumen ? c.dim(` → ${resumen}`) : ''))
  }
}

async function showRag(query: string) {
  const chunks = await retrieve(query, 5, 0.0)
  if (chunks.length === 0) {
    console.log(c.red('   (RAG no recuperó nada — falta conocimiento sobre eso)'))
    return
  }
  console.log(c.dim(`   top ${chunks.length} chunks para "${query}":`))
  for (const ch of chunks) {
    const score = (ch.similarity ?? 0).toFixed(3)
    const preview = ch.content.replace(/\s+/g, ' ').slice(0, 100)
    console.log(c.dim(`   • [${score}] ${preview}…`))
  }
}

async function showMem() {
  const m = await loadMemory(CHANNEL, EXTERNAL_ID)
  console.log(c.dim(`   conversación=${m.conversationId} · estado=${m.status} · turnos=${m.history.length}`))
  console.log(c.dim(`   perfil/resumen: ${m.customerSummary ?? '(vacío — se llena con el job memory/update-profile)'}`))
  console.log(c.dim(`   resumen conversación: ${m.summary ?? '(ninguno)'}`))
}

async function main() {
  if (DO_RESET) {
    await resetConversation()
    console.log(c.dim('— conversación de prueba reiniciada —'))
  }

  console.log(c.bold('\n🤖 Banco de pruebas del bot — CI Quality Group'))
  console.log(c.dim(`canal=${CHANNEL} · id=${EXTERNAL_ID} · /help para comandos · /quit para salir\n`))

  const rl = createInterface({ input: stdin, output: stdout })

  // Aviso si no hay conocimiento cargado todavía.
  const probe = await retrieve('servicios precios chatarra', 1, 0.0)
  if (probe.length === 0) {
    console.log(c.yellow('⚠️  No hay conocimiento en la BD todavía. Carga documentos en /knowledge y precios en /pricing para que el bot responda con datos reales.\n'))
  }

  for (;;) {
    const line = (await rl.question(c.cyan('tú › '))).trim()
    if (!line) continue

    if (line === '/quit' || line === '/exit') break
    if (line === '/help') {
      console.log(c.dim('  /rag <texto>  ver chunks recuperados   /mem  memoria actual'))
      console.log(c.dim('  /reset  reiniciar conversación         /whoami  ids   /quit  salir'))
      continue
    }
    if (line === '/whoami') {
      const m = await loadMemory(CHANNEL, EXTERNAL_ID)
      console.log(c.dim(`  canal=${CHANNEL} · externalId=${EXTERNAL_ID} · conversationId=${m.conversationId}`))
      continue
    }
    if (line === '/mem') { await showMem(); continue }
    if (line === '/reset') { await resetConversation(); console.log(c.dim('  — reiniciada —')); continue }
    if (line.startsWith('/rag ')) { await showRag(line.slice(5).trim()); continue }
    if (line.startsWith('/')) { console.log(c.red('  comando desconocido — /help')); continue }

    // ── Turno real (igual que lib/meta/handle.ts) ──
    const mem = await loadMemory(CHANNEL, EXTERNAL_ID)
    await appendMessage(mem.conversationId, 'user', line)

    const t0 = Date.now()
    let res: Awaited<ReturnType<typeof generateReply>>
    try {
      res = await generateReply({
        message: line,
        history: mem.history,
        conversationId: mem.conversationId,
        customerSummary: mem.customerSummary,
        conversationSummary: mem.summary,
      })
    } catch (e) {
      console.log(c.red(`  ✗ error generando: ${e instanceof Error ? e.message : String(e)}`))
      continue
    }
    const ms = Date.now() - t0

    await appendMessage(mem.conversationId, 'assistant', res.reply)
    console.log(c.green('bot › ') + res.reply)
    printDiagnostics(res)
    console.log(c.dim(`   ⏱  ${ms} ms\n`))
  }

  rl.close()
  console.log(c.dim('\n— fin del banco de pruebas —'))
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
