import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { testScenarios } from '@/lib/db/schema'

/** CRUD de escenarios de prueba (no-code). Bajo /api/panel → protegido por Clerk. */

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

const TOOLS = [
  'lookup_price',
  'list_materials',
  'capture_lead',
  'request_human_handoff',
  'get_location',
  'find_media',
  'log_knowledge_gap',
] as const

const expectationsSchema = z.object({
  expectTools: z.array(z.enum(TOOLS)).optional(),
  forbidTools: z.array(z.enum(TOOLS)).optional(),
  expectContext: z.enum(['any', 'with', 'without']).optional(),
  replyIncludes: z.string().trim().optional(),
  replyExcludes: z.string().trim().optional(),
})

const bodySchema = z.object({
  name: z.string().trim().min(1),
  messages: z.array(z.string().trim().min(1)).min(1, 'Agrega al menos un mensaje.'),
  expectations: expectationsSchema,
})

export async function GET() {
  const rows = await db.select().from(testScenarios).orderBy(desc(testScenarios.createdAt))
  return ok(rows)
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const [row] = await db.insert(testScenarios).values(parsed.data).returning()
  return ok(row)
}

export async function PATCH(req: Request) {
  const parsed = bodySchema.extend({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const { id, ...rest } = parsed.data
  const [row] = await db
    .update(testScenarios)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(testScenarios.id, id))
    .returning()
  if (!row) return fail('El escenario no existe.', 404, 'NOT_FOUND')
  return ok(row)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id.')
  const [row] = await db.delete(testScenarios).where(eq(testScenarios.id, id)).returning({ id: testScenarios.id })
  if (!row) return fail('El escenario no existe.', 404, 'NOT_FOUND')
  return ok({ deleted: id })
}
