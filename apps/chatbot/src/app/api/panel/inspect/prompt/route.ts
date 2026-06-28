import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assembleGeneration } from '@/lib/ai/generate'

/**
 * Visor del system prompt: arma EXACTAMENTE lo que usaría el bot para un mensaje
 * (mismo `assembleGeneration` que generateReply) y lo devuelve, sin llamar al
 * modelo para generar la respuesta (solo el embedding del RAG). Transparencia
 * total de "por qué responde así". Bajo /api/panel → Clerk.
 */
export async function POST(req: Request) {
  const parsed = z
    .object({
      message: z.string().trim().min(1),
      history: z
        .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
        .max(40)
        .optional(),
    })
    .safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Escribe un mensaje.' } },
      { status: 400 },
    )
  }

  try {
    const a = await assembleGeneration({ message: parsed.data.message, history: parsed.data.history })
    return NextResponse.json({
      success: true,
      data: {
        system: a.system,
        model: a.model,
        routerReason: a.routerReason,
        contextUsed: a.contextUsed,
        retrievedCount: a.retrieved.length,
      },
    })
  } catch (e) {
    console.error('inspect/prompt error:', e instanceof Error ? e.message : e)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'No se pudo armar el prompt.' } },
      { status: 500 },
    )
  }
}
