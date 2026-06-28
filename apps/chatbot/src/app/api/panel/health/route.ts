import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemEvents } from '@/lib/db/schema'
import { getHealth } from '@/lib/data/panel'

/**
 * Panel de salud: últimos eventos del sistema (errores/avisos) + resumen de las
 * últimas 24 h. Bajo /api/panel → protegido por Clerk.
 */
function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}

export async function GET() {
  return ok(await getHealth())
}

// DELETE — limpiar la bitácora (botón "Limpiar" del panel).
export async function DELETE() {
  await db.delete(systemEvents)
  return ok({ cleared: true })
}
