import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversations, leads, materials } from '@/lib/db/schema'

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

const STATUSES = ['new', 'contacted', 'quoted', 'ready', 'won', 'lost'] as const

// GET — lista de leads con material y canal
export async function GET() {
  const rows = await db
    .select({
      id: leads.id,
      conversationId: leads.conversationId,
      name: leads.name,
      contact: leads.contact,
      interest: leads.interest,
      materialName: materials.name,
      quantity: leads.quantity,
      unit: leads.unit,
      agreedPriceCop: leads.agreedPriceCop,
      fulfillment: leads.fulfillment,
      scheduledFor: leads.scheduledFor,
      requestedDiscount: leads.requestedDiscount,
      discountApprovedPct: leads.discountApprovedPct,
      status: leads.status,
      notes: leads.notes,
      test: leads.test,
      channel: conversations.channel,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(materials, eq(leads.materialId, materials.id))
    .leftJoin(conversations, eq(leads.conversationId, conversations.id))
    .orderBy(desc(leads.createdAt))
  return ok(rows)
}

// DELETE — borrar un lead (útil para limpiar leads de prueba del playground)
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id del lead.')
  const [row] = await db.delete(leads).where(eq(leads.id, id)).returning({ id: leads.id })
  if (!row) return fail('El lead no existe.', 404, 'NOT_FOUND')
  return ok({ deleted: id })
}

const moneyOrNull = z.union([z.coerce.number().nonnegative(), z.null()]).optional()
const textOrNull = z.string().trim().nullable().optional()

const patchSchema = z
  .object({
    id: z.string().uuid('id inválido.'),
    status: z.enum(STATUSES).optional(),
    discountApprovedPct: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
    notes: textOrNull,
    // Datos del cierre (editables a mano por el asesor).
    quantity: moneyOrNull,
    unit: textOrNull,
    agreedPriceCop: moneyOrNull,
    fulfillment: textOrNull,
    scheduledFor: textOrNull,
  })
  .refine((d) => Object.keys(d).length > 1, 'Nada que actualizar.')

// PATCH — aprobar descuento, cambiar estado, notas, datos del cierre
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const { id, ...rest } = parsed.data

  const num = (v: number | null) => (v === null ? null : String(v))
  const set: Record<string, unknown> = {}
  if (rest.status !== undefined) set.status = rest.status
  if (rest.discountApprovedPct !== undefined)
    set.discountApprovedPct = rest.discountApprovedPct === null ? null : String(rest.discountApprovedPct)
  if (rest.notes !== undefined) set.notes = rest.notes
  if (rest.quantity !== undefined) set.quantity = num(rest.quantity)
  if (rest.unit !== undefined) set.unit = rest.unit
  if (rest.agreedPriceCop !== undefined) set.agreedPriceCop = num(rest.agreedPriceCop)
  if (rest.fulfillment !== undefined) set.fulfillment = rest.fulfillment
  if (rest.scheduledFor !== undefined) set.scheduledFor = rest.scheduledFor

  const [row] = await db.update(leads).set(set).where(eq(leads.id, id)).returning()
  if (!row) return fail('El lead no existe.', 404, 'NOT_FOUND')
  return ok(row)
}
