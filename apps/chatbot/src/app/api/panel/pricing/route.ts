import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { materials } from '@/lib/db/schema'

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// numeric (COP) → se guarda como string; entrada acepta número o string.
const money = z.coerce.number().nonnegative('El precio no puede ser negativo.')
const moneyNullable = z
  .union([z.coerce.number().nonnegative('El valor no puede ser negativo.'), z.null()])
  .optional()

const createSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  category: z.string().trim().min(1).nullable().optional(),
  unit: z.enum(['kg', 'ton', 'unidad']).default('kg'),
  retailPriceCop: money,
  wholesalePriceCop: moneyNullable,
  wholesaleThreshold: moneyNullable,
  active: z.boolean().optional(),
})

const updateSchema = z
  .object({
    id: z.string().uuid('id inválido.'),
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).nullable().optional(),
    unit: z.enum(['kg', 'ton', 'unidad']).optional(),
    retailPriceCop: money.optional(),
    wholesalePriceCop: moneyNullable,
    wholesaleThreshold: moneyNullable,
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 1, 'Nada que actualizar.')

// numeric de Drizzle se escribe como string; null se conserva.
const toNum = (v: number | null | undefined) =>
  v === undefined ? undefined : v === null ? null : String(v)

// GET — lista de materiales (más recientes/actualizados primero)
export async function GET() {
  const rows = await db.select().from(materials).orderBy(desc(materials.updatedAt))
  return ok(rows)
}

// POST — crear material
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  }
  const d = parsed.data
  const [row] = await db
    .insert(materials)
    .values({
      name: d.name,
      category: d.category ?? null,
      unit: d.unit,
      retailPriceCop: String(d.retailPriceCop),
      wholesalePriceCop: toNum(d.wholesalePriceCop) ?? null,
      wholesaleThreshold: toNum(d.wholesaleThreshold) ?? null,
      active: d.active ?? true,
    })
    .returning()
  return ok(row)
}

// PATCH — actualizar material (parcial)
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  }
  const { id, ...rest } = parsed.data

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (rest.name !== undefined) set.name = rest.name
  if (rest.category !== undefined) set.category = rest.category
  if (rest.unit !== undefined) set.unit = rest.unit
  if (rest.retailPriceCop !== undefined) set.retailPriceCop = String(rest.retailPriceCop)
  if (rest.wholesalePriceCop !== undefined) set.wholesalePriceCop = toNum(rest.wholesalePriceCop)
  if (rest.wholesaleThreshold !== undefined) set.wholesaleThreshold = toNum(rest.wholesaleThreshold)
  if (rest.active !== undefined) set.active = rest.active

  const [row] = await db.update(materials).set(set).where(eq(materials.id, id)).returning()
  if (!row) return fail('El material no existe.', 404, 'NOT_FOUND')
  return ok(row)
}

// DELETE — borrar material (leads.material_id → set null por la FK)
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id del material.')
  const [row] = await db.delete(materials).where(eq(materials.id, id)).returning({ id: materials.id })
  if (!row) return fail('El material no existe.', 404, 'NOT_FOUND')
  return ok({ id: row.id })
}
