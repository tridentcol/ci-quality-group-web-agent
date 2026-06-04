import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeChunks, knowledgeGaps, knowledgeSources } from '@/lib/db/schema'
import { chunkText } from '@/lib/ingest/chunk'
import { embedBatch } from '@/lib/ai/embed'

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// GET — huecos (por defecto solo abiertos; ?status=all|resolved)
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get('status')
  const base = db
    .select({
      id: knowledgeGaps.id,
      question: knowledgeGaps.question,
      status: knowledgeGaps.status,
      resolvedAnswer: knowledgeGaps.resolvedAnswer,
      createdAt: knowledgeGaps.createdAt,
    })
    .from(knowledgeGaps)
    .orderBy(desc(knowledgeGaps.createdAt))

  const rows =
    status === 'all' ? await base : await base.where(eq(knowledgeGaps.status, status === 'resolved' ? 'resolved' : 'open'))
  return ok(rows)
}

const resolveSchema = z.object({
  id: z.string().uuid('id inválido.'),
  answer: z.string().trim().min(1, 'Escribe la respuesta.'),
})

// PATCH — resolver hueco: crea fuente FAQ, la embebe y marca el hueco resuelto.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const { id, answer } = parsed.data

  const [gap] = await db.select().from(knowledgeGaps).where(eq(knowledgeGaps.id, id))
  if (!gap) return fail('El hueco no existe.', 404, 'NOT_FOUND')
  if (gap.status === 'resolved') return fail('El hueco ya está resuelto.', 409, 'CONFLICT')

  // 1) Fuente de conocimiento tipo FAQ (lista de inmediato, sin Blob/parse).
  const [source] = await db
    .insert(knowledgeSources)
    .values({
      type: 'faq',
      name: `FAQ: ${gap.question.slice(0, 80)}`,
      status: 'ready',
    })
    .returning({ id: knowledgeSources.id })

  // 2) Embeber el par pregunta/respuesta para que el bot lo recupere por RAG.
  const text = `Pregunta: ${gap.question}\nRespuesta: ${answer}`
  const chunks = chunkText(text)
  const embeddings = await embedBatch(chunks)
  await db.insert(knowledgeChunks).values(
    chunks.map((content, i) => ({
      sourceId: source.id,
      content,
      embedding: embeddings[i],
      metadata: { faq: true, gapId: id, index: i },
    })),
  )

  // 3) Marcar el hueco como resuelto.
  const [updated] = await db
    .update(knowledgeGaps)
    .set({ status: 'resolved', resolvedAnswer: answer, resolvedAt: new Date() })
    .where(eq(knowledgeGaps.id, id))
    .returning()

  return ok({ gap: updated, sourceId: source.id, chunks: chunks.length })
}
