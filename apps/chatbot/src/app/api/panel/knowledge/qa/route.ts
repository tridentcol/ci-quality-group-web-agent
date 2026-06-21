import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { knowledgeQa, knowledgeSources } from '@/lib/db/schema'
import { embed } from '@/lib/ai/embed'

/**
 * CRUD de las preguntas frecuentes (Q&A) generadas/curadas por fuente. El admin
 * puede editar/mejorar la respuesta, corregir la pregunta, agregar preguntas a
 * mano o borrarlas — todo no-code. El embedding es de la PREGUNTA: al cambiarla
 * se re-embebe; al cambiar solo la respuesta no hace falta (cambia el texto que
 * se recupera, no el vector de búsqueda). Bajo /api/panel/* → protegido por Clerk.
 */

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// Mantiene knowledge_sources.qa_count en sincronía tras cada cambio.
async function syncQaCount(sourceId: string) {
  const n = await db.$count(knowledgeQa, eq(knowledgeQa.sourceId, sourceId))
  await db
    .update(knowledgeSources)
    .set({ qaCount: n, updatedAt: new Date() })
    .where(eq(knowledgeSources.id, sourceId))
  return n
}

// GET ?sourceId= — preguntas de una fuente
export async function GET(req: Request) {
  const sourceId = new URL(req.url).searchParams.get('sourceId')
  if (!sourceId) return fail('Falta sourceId.')
  const rows = await db
    .select({
      id: knowledgeQa.id,
      question: knowledgeQa.question,
      answer: knowledgeQa.answer,
      imageId: knowledgeQa.imageId,
    })
    .from(knowledgeQa)
    .where(eq(knowledgeQa.sourceId, sourceId))
    .orderBy(asc(knowledgeQa.createdAt))
  return ok(rows)
}

// POST — agregar una pregunta a mano
const createSchema = z.object({
  sourceId: z.string().uuid(),
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
})
export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Faltan sourceId, question y answer.')
  const { sourceId, question, answer } = parsed.data

  const [src] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
  if (!src) return fail('La fuente no existe.', 404, 'NOT_FOUND')

  const embedding = await embed(question)
  const [row] = await db
    .insert(knowledgeQa)
    .values({ sourceId, question, answer, embedding })
    .returning({ id: knowledgeQa.id, question: knowledgeQa.question, answer: knowledgeQa.answer, imageId: knowledgeQa.imageId })
  await syncQaCount(sourceId)
  return ok(row)
}

// PATCH — editar pregunta/respuesta/medio (re-embebe solo si cambia la pregunta)
const patchSchema = z.object({
  id: z.string().uuid(),
  question: z.string().trim().min(1).optional(),
  answer: z.string().trim().min(1).optional(),
  imageId: z.string().uuid().nullable().optional(),
})
export async function PATCH(req: Request) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Datos inválidos.')
  const { id, question, answer, imageId } = parsed.data
  if (question === undefined && answer === undefined && imageId === undefined)
    return fail('Nada que actualizar.')

  const [cur] = await db.select().from(knowledgeQa).where(eq(knowledgeQa.id, id))
  if (!cur) return fail('La pregunta no existe.', 404, 'NOT_FOUND')

  const set: Record<string, unknown> = {}
  if (answer !== undefined) set.answer = answer
  if (imageId !== undefined) set.imageId = imageId
  if (question !== undefined && question !== cur.question) {
    set.question = question
    set.embedding = await embed(question) // re-embeber al cambiar la pregunta
  } else if (question !== undefined) {
    set.question = question
  }

  const [row] = await db
    .update(knowledgeQa)
    .set(set)
    .where(eq(knowledgeQa.id, id))
    .returning({ id: knowledgeQa.id, question: knowledgeQa.question, answer: knowledgeQa.answer, imageId: knowledgeQa.imageId })
  return ok(row)
}

// DELETE ?id= — borrar una pregunta
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id.')
  const [row] = await db
    .delete(knowledgeQa)
    .where(eq(knowledgeQa.id, id))
    .returning({ id: knowledgeQa.id, sourceId: knowledgeQa.sourceId })
  if (!row) return fail('La pregunta no existe.', 404, 'NOT_FOUND')
  await syncQaCount(row.sourceId)
  return ok({ deleted: id })
}
