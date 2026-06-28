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
 * pipeline del webhook. Los envíos LANZAN ante error para poder reutilizarlos en las
 * pruebas interactivas del onboarding (testChannel).
 */
export interface NotifEmail { enabled?: boolean; to?: string; resendKey?: string; from?: string }
export interface NotifTelegram { enabled?: boolean; token?: string; chatId?: string }
export interface NotificationsConfig {
  email?: NotifEmail
  telegram?: NotifTelegram
  whatsapp?: { enabled?: boolean }
}

async function sendTelegram(c: NotifTelegram, text: string): Promise<void> {
  const token = c.token?.trim() || env.TELEGRAM_BOT_TOKEN
  const chatId = c.chatId?.trim()
  if (!token) throw new Error('Falta el token del bot de Telegram.')
  if (!chatId) throw new Error('Falta el chat id de Telegram.')
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Telegram ${res.status}: ${body.slice(0, 200)}`)
  }
}

async function sendEmail(c: NotifEmail, text: string): Promise<void> {
  const key = c.resendKey?.trim() || env.RESEND_API_KEY
  const to = c.to?.trim()
  const from = c.from?.trim() || 'CI Quality Group <onboarding@resend.dev>'
  if (!key) throw new Error('Falta la API key de Resend.')
  if (!to) throw new Error('Falta el correo destino.')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to, subject: 'CI Quality Group — aviso del bot', text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Email ${res.status}: ${body.slice(0, 200)}`)
  }
}

async function sendWhatsapp(to: string | null, text: string): Promise<void> {
  if (!to) throw new Error('Falta el número del administrador.')
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN)
    throw new Error('WhatsApp Cloud API no está conectado (faltan credenciales en el servidor).')
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

  // Cada canal por separado; un fallo se registra en Salud y no impide los demás.
  const run = async (source: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      await logEvent('warning', source, err instanceof Error ? err.message : String(err))
    }
  }

  const tasks: Promise<void>[] = []
  if (n.telegram?.enabled) tasks.push(run('notify-telegram', () => sendTelegram(n.telegram!, message)))
  if (n.email?.enabled) tasks.push(run('notify-email', () => sendEmail(n.email!, message)))
  if (n.whatsapp?.enabled) tasks.push(run('notify-whatsapp', () => sendWhatsapp(admin, message)))

  // Respaldo: sin nada configurado en la UI pero con WhatsApp en env → usarlo.
  if (tasks.length === 0 && admin && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) {
    tasks.push(run('notify-whatsapp', () => sendWhatsapp(admin, message)))
  }

  if (tasks.length === 0) {
    console.log(`[notifyAdmin: ningún canal configurado] ${message}`)
    return
  }
  await Promise.all(tasks)
}

/** Envía un mensaje de PRUEBA por un canal con la config dada (sin guardar). */
export async function testChannel(
  channel: 'telegram' | 'email' | 'whatsapp',
  cfg: NotificationsConfig,
  adminNumber: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = '✅ Prueba de notificación de CI Quality Group. Si ves esto, el canal quedó bien configurado.'
  try {
    if (channel === 'telegram') await sendTelegram(cfg.telegram ?? {}, text)
    else if (channel === 'email') await sendEmail(cfg.email ?? {}, text)
    else await sendWhatsapp(adminNumber, text)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Detecta el chat id leyendo el último mensaje recibido por el bot (getUpdates). */
export async function detectTelegramChatId(
  token: string,
): Promise<{ ok: true; chatId: string; name: string } | { ok: false; error: string }> {
  const t = token.trim()
  if (!t) return { ok: false, error: 'Falta el token del bot.' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${t}/getUpdates`)
    const json = (await res.json()) as {
      ok: boolean
      description?: string
      result?: Array<{ message?: { chat?: { id: number; first_name?: string; title?: string; username?: string } } }>
    }
    if (!json.ok) return { ok: false, error: json.description ?? 'Token inválido.' }
    const chats = (json.result ?? []).map((u) => u.message?.chat).filter(Boolean)
    const chat = chats[chats.length - 1]
    if (!chat) return { ok: false, error: 'Aún no hay mensajes. Escríbele algo a tu bot y reintenta.' }
    return { ok: true, chatId: String(chat.id), name: chat.title ?? chat.first_name ?? chat.username ?? 'tu chat' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
