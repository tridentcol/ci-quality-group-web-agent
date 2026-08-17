import { NextResponse } from 'next/server'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, customerProfiles, messages, leads } from '@/lib/db/schema'
import { isUuid } from '@/lib/api'
import { listConversations } from '@/lib/data/panel'
import { inngest } from '@/inngest/client'
import { logEvent } from '@/lib/log'

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
  if (id && !isUuid(id)) return fail('id inválido.')

  if (id) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id))
    if (!conv) return fail('La conversación no existe.', 404, 'NOT_FOUND')
    const thread = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt))
    return ok({ conversation: conv, messages: thread })
  }

  return ok(await listConversations())
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

  // Cerrar o tomar el control = fin del turno del bot → actualizar el perfil de
  // largo plazo del cliente (extrae hechos duraderos). Sin esto la memoria de
  // largo plazo nunca se llenaba.
  if (parsed.data.status === 'closed' || parsed.data.status === 'human_controlled') {
    await inngest.send({ name: 'memory/conversation.ended', data: { conversationId: row.id } })
  }
  return ok(row)
}

// DELETE — borrado bajo solicitud (Habeas Data / Ley 1581).
//  ?id=<conv>             → borra la conversación (cascade: mensajes, leads).
//  ?id=<conv>&erase=customer → borra el perfil del cliente y TODAS sus conversaciones.
export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const erase = url.searchParams.get('erase')
  if (!isUuid(id)) return fail('Falta el id de la conversación o es inválido.')

  const [conv] = await db
    .select({ customerId: conversations.customerId })
    .from(conversations)
    .where(eq(conversations.id, id))
  if (!conv) return fail('La conversación no existe.', 404, 'NOT_FOUND')

  if (erase === 'customer' && conv.customerId) {
    // Rastro de auditoría SIN datos personales (solo ref/status, no nombre/contacto):
    // borrar en cascada un lead no debe pasar desapercibido en el Panel de salud.
    const dropped = await db
      .select({ ref: leads.ref, status: leads.status })
      .from(leads)
      .innerJoin(conversations, eq(leads.conversationId, conversations.id))
      .where(eq(conversations.customerId, conv.customerId))
    if (dropped.length > 0) {
      await logEvent(
        'warning',
        'compliance-delete',
        `Borrado Habeas Data de cliente: se eliminaron ${dropped.length} lead(s) en cascada.`,
        { leads: dropped },
      )
    }
    await db.delete(conversations).where(eq(conversations.customerId, conv.customerId)) // cascade
    await db.delete(customerProfiles).where(eq(customerProfiles.id, conv.customerId))
    return ok({ erased: 'customer' })
  }

  const dropped = await db
    .select({ ref: leads.ref, status: leads.status })
    .from(leads)
    .where(eq(leads.conversationId, id))
  if (dropped.length > 0) {
    await logEvent(
      'warning',
      'compliance-delete',
      `Conversación borrada: se eliminó en cascada ${dropped.length} lead(s) asociado(s).`,
      { conversationId: id, leads: dropped },
    )
  }
  await db.delete(conversations).where(eq(conversations.id, id))
  return ok({ erased: 'conversation' })
}
