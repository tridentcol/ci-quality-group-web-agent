import { NextResponse } from 'next/server'
import { desc, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { systemEvents } from '@/lib/db/schema'

/**
 * Panel de salud: últimos eventos del sistema (errores/avisos) + resumen de las
 * últimas 24 h. Bajo /api/panel → protegido por Clerk.
 */
function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}

export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [events, counts] = await Promise.all([
    db.select().from(systemEvents).orderBy(desc(systemEvents.createdAt)).limit(100),
    db
      .select({ level: systemEvents.level, n: sql<number>`count(*)::int` })
      .from(systemEvents)
      .where(gte(systemEvents.createdAt, since))
      .groupBy(systemEvents.level),
  ])

  const summary = { error: 0, warning: 0, info: 0 } as Record<string, number>
  for (const c of counts) summary[c.level] = c.n
  return ok({ events, summary })
}

// DELETE — limpiar la bitácora (botón "Limpiar" del panel).
export async function DELETE() {
  await db.delete(systemEvents)
  return ok({ cleared: true })
}
