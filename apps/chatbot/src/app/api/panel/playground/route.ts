import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateReply } from '@/lib/ai/generate'

/**
 * Banco de pruebas del bot desde el panel (equivalente web de scripts/chat.ts).
 * Ejecuta el motor real (RAG + router + tools) en modo `test` (playground): SÍ
 * captura leads y registra huecos para ver el flujo como en producción, pero los
 * leads quedan marcados como prueba (lead.test) y NO se notifica al admin ni se
 * cambian conversaciones reales. Devuelve la respuesta + el detalle para depurar
 * (modelo, router, chunks con score, tools). Bajo /api/panel/* → protegido por Clerk.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = z
    .object({
      message: z.string().trim().min(1),
      // Historial de la conversación de prueba (turnos previos), para probar
      // flujos multi-turno con memoria de corto plazo. Efímero: vive en el cliente.
      history: z
        .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
        .max(40)
        .optional(),
    })
    .safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Escribe un mensaje.' } },
      { status: 400 },
    )
  }

  try {
    const res = await generateReply({
      message: parsed.data.message,
      history: parsed.data.history,
      mode: 'test',
    })
    return NextResponse.json({ success: true, data: res })
  } catch (e) {
    console.error('playground generate error:', e instanceof Error ? e.message : e)
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE', message: 'No se pudo generar la respuesta. Reintenta.' } },
      { status: 500 },
    )
  }
}
