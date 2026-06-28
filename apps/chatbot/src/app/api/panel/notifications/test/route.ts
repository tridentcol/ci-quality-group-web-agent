import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'
import { testChannel, type NotificationsConfig } from '@/lib/meta/notify'

/**
 * Envía una notificación de PRUEBA por un canal usando la config que llega del form
 * (aún sin guardar), para validar el onboarding al instante. Bajo /api/panel → Clerk.
 */
const schema = z.object({
  channel: z.enum(['telegram', 'email', 'whatsapp']),
  config: z
    .object({
      telegram: z.object({ token: z.string().optional(), chatId: z.string().optional() }).optional(),
      email: z
        .object({ to: z.string().optional(), resendKey: z.string().optional(), from: z.string().optional() })
        .optional(),
    })
    .optional(),
})

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { message: 'Datos inválidos.' } }, { status: 400 })
  }
  const { channel, config } = parsed.data

  // El número de WhatsApp sale de la config guardada (adminWhatsapp).
  const [cfg] = await db.select({ admin: botConfig.adminWhatsapp }).from(botConfig).where(eq(botConfig.id, 1))

  const result = await testChannel(channel, (config ?? {}) as NotificationsConfig, cfg?.admin ?? null)
  if (result.ok) return NextResponse.json({ success: true, data: { sent: true } })
  return NextResponse.json({ success: false, error: { message: result.error } }, { status: 422 })
}
