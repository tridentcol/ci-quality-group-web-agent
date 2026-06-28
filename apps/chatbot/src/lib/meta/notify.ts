import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'
import { env } from '@/lib/env'
import { logEvent } from '@/lib/log'
import { sendText } from './send'

/**
 * Centro de notificaciones al admin (leads nuevos, relevos): envía el aviso por
 * TODOS los canales activos (Telegram, Email, WhatsApp), configurados desde la UI
 * (bot_config.notifications) o por variables de entorno. Best-effort: cada canal se
 * intenta por separado y un fallo se registra en el Panel de salud, sin tumbar el
 * pipeline del webhook. El mensaje ya trae el enlace al lead/conversación.
 */
export interface NotificationsConfig {
  email?: { enabled?: boolean; to?: string; resendKey?: string; from?: string }
  telegram?: { enabled?: boolean; token?: string; chatId?: string }
  whatsapp?: { enabled?: boolean }
}

async function sendTelegram(c: NonNullable<NotificationsConfig['telegram']>, text: string): Promise<void> {
  const token = c.token?.trim() || env.TELEGRAM_BOT_TOKEN
  const chatId = c.chatId?.trim()
  if (!token || !chatId) {
    await logEvent('warning', 'notify-telegram', 'Telegram activo pero falta token o chat id.')
    return
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  })
  if (!res.ok) {
    await logEvent('warning', 'notify-telegram', `Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}

async function sendEmail(c: NonNullable<NotificationsConfig['email']>, text: string): Promise<void> {
  const key = c.resendKey?.trim() || env.RESEND_API_KEY
  const to = c.to?.trim()
  const from = c.from?.trim() || 'CI Quality Group <onboarding@resend.dev>'
  if (!key || !to) {
    await logEvent('warning', 'notify-email', 'Email activo pero falta API key o destinatario.')
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to, subject: 'CI Quality Group — aviso del bot', text }),
  })
  if (!res.ok) {
    await logEvent('warning', 'notify-email', `Email ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}

async function sendWhatsapp(to: string | null, text: string): Promise<void> {
  if (!to || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    await logEvent('warning', 'notify-whatsapp', 'WhatsApp activo pero falta número o credenciales de la Cloud API.')
    return
  }
  await sendText('whatsapp', to, text)
}

export async function notifyAdmin(message: string): Promise<void> {
  let cfg: { notifications: unknown; admin: string | null } | undefined
  try {
    ;[cfg] = await db
      .select({ notifications: botConfig.notifications, admin: botConfig.adminWhatsapp })
      .from(botConfig)
      .where(eq(botConfig.id, 1))
  } catch (err) {
    console.error('notifyAdmin: no se pudo leer la config:', err instanceof Error ? err.message : err)
    return
  }

  const n = (cfg?.notifications ?? {}) as NotificationsConfig
  const admin = cfg?.admin ?? env.ADMIN_WHATSAPP_NUMBER ?? null
  const tasks: Promise<void>[] = []

  if (n.telegram?.enabled) tasks.push(sendTelegram(n.telegram, message))
  if (n.email?.enabled) tasks.push(sendEmail(n.email, message))
  if (n.whatsapp?.enabled) tasks.push(sendWhatsapp(admin, message))

  // Respaldo: si no hay NADA configurado en la UI pero sí WhatsApp en env, usarlo
  // (comportamiento previo, para no perder avisos en setups antiguos).
  if (tasks.length === 0 && admin && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) {
    tasks.push(sendWhatsapp(admin, message))
  }

  if (tasks.length === 0) {
    console.log(`[notifyAdmin: ningún canal configurado] ${message}`)
    return
  }

  // Cada canal por separado; un fallo no impide los demás (ya se registró en salud).
  await Promise.allSettled(tasks)
}
