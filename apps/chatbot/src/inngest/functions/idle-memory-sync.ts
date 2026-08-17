import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { inngest } from '@/inngest/client'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'

/**
 * memory/idle-sync (hallazgo de auditoría 16 ago 2026): `memory/conversation.ended`
 * —el evento que llena `customer_profiles.facts`, la memoria de largo plazo— solo
 * se disparaba con intervención humana (relevo, cierre manual, respuesta manual).
 * Cuando el bot atiende una conversación de punta a punta SOLO (el caso normal),
 * nunca se disparaba: en producción, el 100% de los perfiles quedaban con `facts`
 * vacío. Este cron corre cada hora y dispara el cierre por INACTIVIDAD para las
 * conversaciones que el bot maneja solo y llevan un rato sin movimiento.
 */
const IDLE_HOURS = 3
const BATCH_LIMIT = 50

export const idleMemorySync = inngest.createFunction(
  {
    id: 'memory-idle-sync',
    name: 'Memoria: cerrar por inactividad (bot solo)',
    triggers: [{ cron: 'TZ=America/Bogota 0 * * * *' }, { event: 'memory/idle-sync.run' }],
  },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - IDLE_HOURS * 60 * 60 * 1000)

    const candidates = await step.run('find-idle', async () => {
      return db
        .select({ id: conversations.id, lastMessageAt: conversations.lastMessageAt })
        .from(conversations)
        .where(
          and(
            eq(conversations.status, 'bot_active'),
            lt(conversations.lastMessageAt, cutoff),
            or(isNull(conversations.memorySyncedAt), lt(conversations.memorySyncedAt, conversations.lastMessageAt)),
          ),
        )
        .limit(BATCH_LIMIT)
    })

    if (candidates.length === 0) return { synced: 0 }

    await step.run('mark-synced', async () => {
      for (const c of candidates) {
        await db.update(conversations).set({ memorySyncedAt: new Date() }).where(eq(conversations.id, c.id))
      }
    })

    await step.sendEvent(
      'trigger-ended',
      candidates.map((c) => ({ name: 'memory/conversation.ended' as const, data: { conversationId: c.id } })),
    )

    return { synced: candidates.length, cutoff: cutoff.toISOString() }
  },
)
