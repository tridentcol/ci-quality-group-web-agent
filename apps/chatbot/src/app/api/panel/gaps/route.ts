import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeGaps } from '@/lib/db/schema'
import { resolveGapToKnowledge } from '@/lib/ai/gaps'
import { listGaps } from '@/lib/data/panel'

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// GET — huecos (por defecto solo abiertos; ?status=all|resolved). Compartida con la página.
export async function GET(req: Request) {
  const s = new URL(req.url).searchParams.get('status')
  const status = s === 'all' ? 'all' : s === 'resolved' ? 'resolved' : 'open'
  return ok(await listGaps(status))
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
