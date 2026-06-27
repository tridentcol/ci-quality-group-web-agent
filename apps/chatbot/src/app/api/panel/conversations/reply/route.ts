import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, images, messages } from '@/lib/db/schema'
import { sendText, sendMedia } from '@/lib/meta/send'
import type { Channel } from '@/lib/meta/normalize'
import { inngest } from '@/inngest/client'

/**
 * Responder a un cliente COMO AGENTE HUMANO desde el panel (relevo). Envía por el
 * canal del cliente (Send API), registra el mensaje como `human_agent`, y deja la
 * conversación en `human_controlled` (el bot queda en pausa hasta "Liberar al bot").
 * Bajo /api/panel/* → protegido por Clerk.
 */
function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

const META_CHANNELS = ['messenger', 'whatsapp', 'instagram'] as const

const bodySchema = z.object({
  id: z.string().uuid('Conversación inválida.'),
  text: z.string().trim().max(4000).optional(),
  imageId: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const { id, text, imageId } = parsed.data

  if (!text && !imageId) return fail('Escribe un mensaje o adjunta un medio.')

  const [conv] = await db
    .select({ channel: conversations.channel, externalId: conversations.externalId })
    .from(conversations)
    .where(eq(conversations.id, id))
  if (!conv) return fail('La conversación no existe.', 404, 'NOT_FOUND')

  if (!META_CHANNELS.includes(conv.channel as (typeof META_CHANNELS)[number])) {
    return fail(`El canal "${conv.channel}" no admite respuesta manual desde el panel.`)
  }
  const channel = conv.channel as Channel
  const to = conv.externalId

  // Enviar por el canal del cliente. Si falla (canal sin configurar, token, etc.) se
  // reporta el error y NO se registra el mensaje (no mentir sobre lo enviado).
  const created: typeof messages.$inferSelect[] = []
  try {
    if (text) {
      await sendText(channel, to, text)
      const [row] = await db
        .insert(messages)
        .values({ conversationId: id, role: 'human_agent', content: text })
        .returning()
      created.push(row)
    }
    if (imageId) {
      const [img] = await db
        .select({ url: images.url, type: images.type, name: images.name })
        .from(images)
        .where(eq(images.id, imageId))
      if (!img) return fail('El medio no existe.', 404, 'NOT_FOUND')
      await sendMedia(channel, to, {
        url: img.url,
        type: img.type === 'video' ? 'video' : 'image',
        caption: text || undefined,
      })
      const [row] = await db
        .insert(messages)
        .values({
          conversationId: id,
          role: 'human_agent',
          content: `${img.type === 'video' ? '🎬' : '📎'} ${img.name}`,
        })
        .returning()
      created.push(row)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo enviar el mensaje.'
    return fail(message, 502, 'SEND_FAILED')
  }

  // Responder a mano = tomar el control: el bot queda en pausa.
  await db
    .update(conversations)
    .set({ status: 'human_controlled', lastMessageAt: new Date() })
    .where(eq(conversations.id, id))
  await inngest.send({ name: 'memory/conversation.ended', data: { conversationId: id } })

  return ok({ messages: created, status: 'human_controlled' })
}
