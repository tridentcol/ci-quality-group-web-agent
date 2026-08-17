import { and, inArray, lt } from 'drizzle-orm'
import { inngest } from '@/inngest/client'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema'
import { logEvent } from '@/lib/log'

/**
 * compliance/stale-ingest-check (hallazgo de auditoría 17 ago 2026): una fuente de
 * conocimiento puede quedar en `pending`/`processing` para siempre si el evento
 * `ingest/source.uploaded` nunca se consume (ej. Inngest local caído al correr un
 * smoke test contra la BD real) — y antes nadie se enteraba salvo entrando a mano
 * a la pestaña Conocimiento. Este cron diario avisa en el Panel de salud de
 * cualquier fuente atascada hace más de 2 horas (la ingesta normal tarda segundos).
 */
const STALE_AFTER_HOURS = 2

export const staleIngestCheck = inngest.createFunction(
  {
    id: 'stale-ingest-check',
    name: 'Cumplimiento: fuentes de conocimiento atascadas',
    triggers: [{ cron: 'TZ=America/Bogota 0 9 * * *' }, { event: 'compliance/stale-ingest-check.run' }],
  },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000)

    const stale = await step.run('find-stale', async () => {
      return db
        .select({ id: knowledgeSources.id, name: knowledgeSources.name, status: knowledgeSources.status })
        .from(knowledgeSources)
        .where(and(inArray(knowledgeSources.status, ['pending', 'processing']), lt(knowledgeSources.createdAt, cutoff)))
    })

    if (stale.length === 0) return { stale: 0 }

    await step.run('log-stale', async () => {
      await logEvent(
        'warning',
        'ingest',
        `${stale.length} fuente(s) de conocimiento atascada(s) en pending/processing hace más de ${STALE_AFTER_HOURS}h.`,
        { sources: stale },
      )
    })

    return { stale: stale.length }
  },
)
