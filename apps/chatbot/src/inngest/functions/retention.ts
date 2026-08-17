import { eq, lt } from 'drizzle-orm'
import { inngest } from '@/inngest/client'
import { db } from '@/lib/db'
import { botConfig, conversations, customerProfiles, webhookEvents } from '@/lib/db/schema'
import { subtractMonths } from '@/lib/date-utils'

/**
 * Retención de datos (blueprint §9 Step 13 · Ley 1581/2012). Corre por cron
 * (diario, hora Colombia) y también bajo demanda (evento compliance/retention.run).
 * Borra conversaciones y perfiles más viejos que `bot_config.retention_months`
 * (al borrar la conversación caen en cascada sus mensajes y leads), y limpia los
 * registros de idempotencia vencidos.
 */
export const retentionCleanup = inngest.createFunction(
  {
    id: 'compliance-retention',
    name: 'Cumplimiento: retención de datos',
    triggers: [{ cron: 'TZ=America/Bogota 0 3 * * *' }, { event: 'compliance/retention.run' }],
  },
  async ({ step }) => {
    const months = await step.run('load-retention', async () => {
      const [cfg] = await db
        .select({ m: botConfig.retentionMonths })
        .from(botConfig)
        .where(eq(botConfig.id, 1))
      return cfg?.m ?? 12
    })

    const cutoff = subtractMonths(new Date(), months)

    const result = await step.run('delete-expired', async () => {
      const convs = await db
        .delete(conversations)
        .where(lt(conversations.lastMessageAt, cutoff))
        .returning({ id: conversations.id })
      const profiles = await db
        .delete(customerProfiles)
        .where(lt(customerProfiles.lastSeenAt, cutoff))
        .returning({ id: customerProfiles.id })
      await db.delete(webhookEvents).where(lt(webhookEvents.processedAt, cutoff))
      return { conversations: convs.length, profiles: profiles.length }
    })

    return { months, cutoff: cutoff.toISOString(), ...result }
  },
)
