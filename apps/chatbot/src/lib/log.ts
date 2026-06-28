import { db } from '@/lib/db'
import { systemEvents } from '@/lib/db/schema'

/**
 * Bitácora de salud: registra errores/avisos en `system_events` para verlos en el
 * Panel de salud (antes solo iban a console y nadie los veía). Es BEST-EFFORT: nunca
 * lanza —si la BD falla, cae a console— para no romper el flujo que lo invoca.
 */
type Level = 'error' | 'warning' | 'info'

export async function logEvent(
  level: Level,
  source: string,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  // Siempre en consola (útil en local y en los logs de Vercel).
  const line = `[${level}] ${source}: ${message}`
  if (level === 'error') console.error(line)
  else console.log(line)

  try {
    await db.insert(systemEvents).values({
      level,
      source,
      message: message.slice(0, 2000),
      context: context ?? null,
    })
  } catch (err) {
    console.error('logEvent: no se pudo registrar en system_events:', err instanceof Error ? err.message : err)
  }
}
