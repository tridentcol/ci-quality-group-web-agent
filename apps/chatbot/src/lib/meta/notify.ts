import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'
import { env } from '@/lib/env'
import { logEvent } from '@/lib/log'
import { sendText } from './send'

/**
 * Aviso al administrador por WhatsApp (leads nuevos, relevos humanos) —
 * blueprint §9 Step 8/10. Resuelve el número desde `bot_config.adminWhatsapp`
 * (o `ADMIN_WHATSAPP_NUMBER`) y envía por la Cloud API. Nunca lanza: si falla
 * o falta configuración, solo registra (no debe tumbar el pipeline del webhook).
 */
export async function notifyAdmin(message: string): Promise<void> {
  try {
    const [cfg] = await db
      .select({ admin: botConfig.adminWhatsapp })
      .from(botConfig)
      .where(eq(botConfig.id, 1))

    const to = cfg?.admin ?? env.ADMIN_WHATSAPP_NUMBER ?? null

    if (to && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) {
      await sendText('whatsapp', to, message)
    } else {
      console.log(`[notifyAdmin → ${to ?? 'sin número configurado'}] ${message}`)
    }
  } catch (err) {
    await logEvent('warning', 'notify', `No se pudo avisar al admin: ${err instanceof Error ? err.message : err}`)
  }
}
