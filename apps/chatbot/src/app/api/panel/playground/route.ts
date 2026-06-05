import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateReply } from '@/lib/ai/generate'

/**
 * Banco de pruebas del bot desde el panel (equivalente web de scripts/chat.ts).
 * Ejecuta el motor real (RAG + router + tools) en modo `dryRun` —no crea leads,
 * huecos ni cambia el estado de conversaciones— y devuelve la respuesta junto con
 * el detalle para depurar: modelo, razón del router, chunks recuperados con score
 * y tools llamadas. Bajo /api/panel/* → protegido por Clerk.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = z.object({ message: z.string().trim().min(1) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Escribe un mensaje.' } },
      { status: 400 },
    )
  }

  try {
    const res = await generateReply({ message: parsed.data.message, dryRun: true })
    return NextResponse.json({ success: true, data: res })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE', message: e instanceof Error ? e.message : 'Error' } },
      { status: 500 },
    )
  }
}
