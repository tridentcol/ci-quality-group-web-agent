import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { knowledgeQa, knowledgeSources } from '@/lib/db/schema'
import { generateQa } from '@/lib/ai/qa-extract'
import { embedBatch } from '@/lib/ai/embed'

/**
 * Regenera las preguntas frecuentes (Q&A) de una fuente desde su texto canónico
 * (gpt-4o-mini): reemplaza las existentes. Usa la API (cuesta ~½ centavo) — el
 * cliente confirma antes. Bajo /api/panel/* → protegido por Clerk.
 */
export async function POST(req: Request) {
  const parsed = z.object({ sourceId: z.string().uuid() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Falta sourceId.' } },
      { status: 400 },
    )
  }
  const { sourceId } = parsed.data

  const [src] = await db
    .select({ content: knowledgeSources.content })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
  if (!src) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'La fuente no existe.' } },
      { status: 404 },
    )
  }
  if (!src.content?.trim()) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_CONTENT', message: 'La fuente no tiene texto para generar preguntas.' } },
      { status: 422 },
    )
  }

  try {
    const pairs = await generateQa(src.content)
    await db.delete(knowledgeQa).where(eq(knowledgeQa.sourceId, sourceId))
    if (pairs.length > 0) {
      const embeddings = await embedBatch(pairs.map((p) => p.question))
      await db.insert(knowledgeQa).values(
        pairs.map((p, i) => ({ sourceId, question: p.question, answer: p.answer, embedding: embeddings[i] })),
      )
    }
    await db
      .update(knowledgeSources)
      .set({ qaCount: pairs.length, updatedAt: new Date() })
      .where(eq(knowledgeSources.id, sourceId))

    return NextResponse.json({ success: true, data: { count: pairs.length } })
  } catch (e) {
    console.error('qa/regenerate error:', e instanceof Error ? e.message : e)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'No se pudieron regenerar las preguntas.' } },
      { status: 500 },
    )
  }
}
