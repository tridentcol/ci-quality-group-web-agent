import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'
import { env } from '@/lib/env'

/**
 * Aviso al administrador (leads nuevos, relevos humanos).
 *
 * Step 8: define la interfaz que usan las tools del bot. El envío real por
 * plantilla de WhatsApp (Send API de Meta) se implementa en el Step 10
 * (`lib/meta/send.ts`); por ahora resuelve el destinatario y registra el aviso.
 */
export async function notifyAdmin(message: string): Promise<void> {
  const [cfg] = await db
    .select({ admin: botConfig.adminWhatsapp })
    .from(botConfig)
    .where(eq(botConfig.id, 1))

  const to = cfg?.admin ?? env.ADMIN_WHATSAPP_NUMBER ?? null

  // TODO(Step 10): enviar plantilla de WhatsApp al admin vía Send API.
  console.log(`[notifyAdmin → ${to ?? 'sin número configurado'}] ${message}`)
}
