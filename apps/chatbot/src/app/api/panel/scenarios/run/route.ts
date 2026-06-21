import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { testScenarios } from '@/lib/db/schema'
import { runScenario, type ScenarioExpectations } from '@/lib/ai/scenario'

/**
 * Corre uno o todos los escenarios de prueba en modo eval (no escribe nada) y
 * devuelve pass/fail con el detalle. Usa el modelo (cuesta unos centavos por
 * escenario, según turnos). Bajo /api/panel → protegido por Clerk.
 */
export async function POST(req: Request) {
  const parsed = z.object({ id: z.string().uuid().optional() }).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Datos inválidos.' } },
      { status: 400 },
    )
  }

  const rows = parsed.data.id
    ? await db.select().from(testScenarios).where(eq(testScenarios.id, parsed.data.id))
    : await db.select().from(testScenarios)

  const results = []
  for (const s of rows) {
    const r = await runScenario(s.messages as string[], (s.expectations ?? {}) as ScenarioExpectations)
    results.push({ id: s.id, name: s.name, ...r })
  }

  return NextResponse.json({ success: true, data: results })
}
