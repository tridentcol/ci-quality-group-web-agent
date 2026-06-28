import { NextResponse } from 'next/server'
import { z } from 'zod'
import { retrieve } from '@/lib/ai/retrieve'
import { RAG_MIN_SCORE } from '@/lib/ai/rag-config'

/**
 * Inspector de RAG: dada una consulta, devuelve los fragmentos que recupera con
 * su score, SIN llamar al modelo (solo 1 embedding → casi gratis). Trae hasta 10
 * con umbral 0 para ver también los que "casi" pasan; el cliente marca cuáles
 * superan el umbral real (RAG_MIN_SCORE) que usa el bot. Bajo /api/panel → Clerk.
 */
export async function POST(req: Request) {
  const parsed = z.object({ query: z.string().trim().min(1) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Escribe una consulta.' } },
      { status: 400 },
    )
  }

  try {
    const chunks = await retrieve(parsed.data.query, 10, 0)
    const results = chunks.map((c) => {
      const meta = (c.metadata ?? {}) as { qa?: boolean }
      return {
        content: c.content,
        similarity: c.similarity,
        kind: meta.qa ? 'qa' : 'chunk',
        used: c.similarity >= RAG_MIN_SCORE,
      }
    })
    return NextResponse.json({ success: true, data: { threshold: RAG_MIN_SCORE, results } })
  } catch (e) {
    console.error('inspect/rag error:', e instanceof Error ? e.message : e)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'No se pudo inspeccionar el RAG.' } },
      { status: 500 },
    )
  }
}
