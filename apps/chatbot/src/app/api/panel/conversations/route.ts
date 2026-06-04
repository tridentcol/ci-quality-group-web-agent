import { NextResponse } from 'next/server'
import { z } from 'zod'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

const STATUSES = ['bot_active', 'human_controlled', 'closed'] as const

// GET — lista de conversaciones, o el hilo de una (?id=)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')

  if (id) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id))
    if (!conv) return fail('La conversación no existe.', 404, 'NOT_FOUND')
    const thread = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt))
    return ok({ conversation: conv, messages: thread })
  }

  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      customerName: conversations.customerName,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.lastMessageAt))
  return ok(rows)
}

const patchSchema = z.object({
  id: z.string().uuid('id inválido.'),
  status: z.enum(STATUSES),
})

// PATCH — tomar (human_controlled) / liberar (bot_active) / cerrar
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

  const [row] = await db
    .update(conversations)
    .set({ status: parsed.data.status })
    .where(eq(conversations.id, parsed.data.id))
    .returning({ id: conversations.id, status: conversations.status })
  if (!row) return fail('La conversación no existe.', 404, 'NOT_FOUND')
  return ok(row)
}
