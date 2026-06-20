import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeQa } from '@/lib/db/schema'

/**
 * Preguntas frecuentes (Q&A) generadas de una fuente, para mostrar en el panel
 * el valor que aporta cada documento. Bajo /api/panel/* → protegido por Clerk.
 */
export async function GET(req: Request) {
  const sourceId = new URL(req.url).searchParams.get('sourceId')
  if (!sourceId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Falta sourceId.' } },
      { status: 400 },
    )
  }

  const rows = await db
    .select({ id: knowledgeQa.id, question: knowledgeQa.question, answer: knowledgeQa.answer })
    .from(knowledgeQa)
    .where(eq(knowledgeQa.sourceId, sourceId))
    .orderBy(asc(knowledgeQa.createdAt))

  return NextResponse.json({ success: true, data: rows })
}
