import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeGaps } from '@/lib/db/schema'
import { resolveGapToKnowledge } from '@/lib/ai/gaps'

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

  // Resolver = convertir la respuesta en FAQ embebida + marcar resuelto.
  const { sourceId, chunks } = await resolveGapToKnowledge(gap.id, gap.question, answer)

  const [updated] = await db
    .select()
    .from(knowledgeGaps)
    .where(eq(knowledgeGaps.id, id))

  return ok({ gap: updated, sourceId, chunks })
}
