import { NextResponse } from 'next/server'
import { z } from 'zod'
import { detectTelegramChatId } from '@/lib/meta/notify'

/**
 * Detecta el chat id de Telegram leyendo el último mensaje que recibió el bot
 * (getUpdates), para autocompletar el onboarding. Bajo /api/panel → Clerk.
 */
export async function POST(req: Request) {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { message: 'Falta el token.' } }, { status: 400 })
  }
  const result = await detectTelegramChatId(parsed.data.token)
  if (result.ok) return NextResponse.json({ success: true, data: { chatId: result.chatId, name: result.name } })
  return NextResponse.json({ success: false, error: { message: result.error } }, { status: 422 })
}
