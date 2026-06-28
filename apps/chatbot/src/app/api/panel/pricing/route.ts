import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { materials } from '@/lib/db/schema'
import { isUuid } from '@/lib/api'
import { listMaterials } from '@/lib/data/panel'

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

// Unidad LIBRE (kg, ton, unidad, libra, metro, galón…), no una lista fija.
const unit = z.string().trim().min(1).max(20)

const createSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  category: z.string().trim().min(1).nullable().optional(),
  unit: unit.default('kg'),
  retailPriceCop: money,
  wholesalePriceCop: moneyNullable,
  wholesaleThreshold: moneyNullable,
  wholesalePrice2Cop: moneyNullable,
  wholesaleThreshold2: moneyNullable,
  minOrder: moneyNullable,
  active: z.boolean().optional(),
})

const updateSchema = z
  .object({
    id: z.string().uuid('id inválido.'),
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).nullable().optional(),
    unit: unit.optional(),
    retailPriceCop: money.optional(),
    wholesalePriceCop: moneyNullable,
    wholesaleThreshold: moneyNullable,
    wholesalePrice2Cop: moneyNullable,
    wholesaleThreshold2: moneyNullable,
    minOrder: moneyNullable,
    active: z.boolean().optional(),
    imageId: z.string().uuid().nullable().optional(), // medio fijo del material
  })
  .refine((d) => Object.keys(d).length > 1, 'Nada que actualizar.')

// numeric de Drizzle se escribe como string; null se conserva.
const toNum = (v: number | null | undefined) =>
  v === undefined ? undefined : v === null ? null : String(v)

// GET — lista de materiales (consulta compartida con la página)
export async function GET() {
  return ok(await listMaterials())
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
      wholesalePrice2Cop: toNum(d.wholesalePrice2Cop) ?? null,
      wholesaleThreshold2: toNum(d.wholesaleThreshold2) ?? null,
      minOrder: toNum(d.minOrder) ?? null,
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
  if (rest.wholesalePrice2Cop !== undefined) set.wholesalePrice2Cop = toNum(rest.wholesalePrice2Cop)
  if (rest.wholesaleThreshold2 !== undefined) set.wholesaleThreshold2 = toNum(rest.wholesaleThreshold2)
  if (rest.minOrder !== undefined) set.minOrder = toNum(rest.minOrder)
  if (rest.active !== undefined) set.active = rest.active
  if (rest.imageId !== undefined) set.imageId = rest.imageId

  const [row] = await db.update(materials).set(set).where(eq(materials.id, id)).returning()
  if (!row) return fail('El material no existe.', 404, 'NOT_FOUND')
  return ok(row)
}

// DELETE — borrar material (leads.material_id → set null por la FK)
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!isUuid(id)) return fail('Falta el id del material o es inválido.')
  const [row] = await db.delete(materials).where(eq(materials.id, id)).returning({ id: materials.id })
  if (!row) return fail('El material no existe.', 404, 'NOT_FOUND')
  return ok({ id: row.id })
}
