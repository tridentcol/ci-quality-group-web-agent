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

const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const

// GET — lista de leads con material y canal
export async function GET() {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      contact: leads.contact,
      interest: leads.interest,
      materialName: materials.name,
      quantity: leads.quantity,
      requestedDiscount: leads.requestedDiscount,
      discountApprovedPct: leads.discountApprovedPct,
      status: leads.status,
      notes: leads.notes,
      channel: conversations.channel,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(materials, eq(leads.materialId, materials.id))
    .leftJoin(conversations, eq(leads.conversationId, conversations.id))
    .orderBy(desc(leads.createdAt))
  return ok(rows)
}

const patchSchema = z
  .object({
    id: z.string().uuid('id inválido.'),
    status: z.enum(STATUSES).optional(),
    discountApprovedPct: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 1, 'Nada que actualizar.')

// PATCH — aprobar descuento, cambiar estado, notas
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const { id, ...rest } = parsed.data

  const set: Record<string, unknown> = {}
  if (rest.status !== undefined) set.status = rest.status
  if (rest.discountApprovedPct !== undefined)
    set.discountApprovedPct = rest.discountApprovedPct === null ? null : String(rest.discountApprovedPct)
  if (rest.notes !== undefined) set.notes = rest.notes

  const [row] = await db.update(leads).set(set).where(eq(leads.id, id)).returning()
  if (!row) return fail('El lead no existe.', 404, 'NOT_FOUND')
  return ok(row)
}
