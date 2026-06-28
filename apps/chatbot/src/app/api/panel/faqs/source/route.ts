import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema'

/**
 * Fuente singleton "Preguntas frecuentes (manual)" para las FAQs rápidas: el admin
 * escribe pregunta/respuesta sin subir documentos y el bot las usa por RAG (las Q&A
 * se embeben). Get-or-create idempotente. Bajo /api/panel → protegido por Clerk.
 */
const FAQ_NAME = 'Preguntas frecuentes (manual)'

export async function GET() {
  const [existing] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.type, 'faq'), eq(knowledgeSources.name, FAQ_NAME)))
    .limit(1)

  if (existing) return NextResponse.json({ success: true, data: { id: existing.id } })

  const [row] = await db
    .insert(knowledgeSources)
    .values({ type: 'faq', name: FAQ_NAME, status: 'ready' })
    .returning({ id: knowledgeSources.id })
  return NextResponse.json({ success: true, data: { id: row.id } })
}
