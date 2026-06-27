import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { count, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { images, knowledgeQa, materials } from '@/lib/db/schema'
import { embed } from '@/lib/ai/embed'

/**
 * Banco de imágenes. Cada imagen se embebe por nombre+descripción+etiquetas para
 * que el bot la encuentre por similitud (tool find_image) y la adjunte. La URL es
 * pública (Blob) para que Meta la descargue. Bajo /api/panel/* → Clerk.
 */

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// Texto que se embebe para la búsqueda semántica.
function embedText(name: string, description: string, tags: string[]): string {
  return [name, description, tags.join(', ')].filter(Boolean).join('. ')
}

// GET — lista de medios (sin el embedding) + en cuántos materiales y preguntas
// está vinculado cada uno (visibilidad del wiring).
export async function GET() {
  const [rows, matUses, qaUses] = await Promise.all([
    db
      .select({
        id: images.id,
        type: images.type,
        name: images.name,
        description: images.description,
        tags: images.tags,
        url: images.url,
        updatedAt: images.updatedAt,
      })
      .from(images)
      .orderBy(desc(images.createdAt)),
    db
      .select({ imageId: materials.imageId, n: count() })
      .from(materials)
      .where(isNotNull(materials.imageId))
      .groupBy(materials.imageId),
    db
      .select({ imageId: knowledgeQa.imageId, n: count() })
      .from(knowledgeQa)
      .where(isNotNull(knowledgeQa.imageId))
      .groupBy(knowledgeQa.imageId),
  ])

  const matMap = new Map(matUses.map((r) => [r.imageId, r.n]))
  const qaMap = new Map(qaUses.map((r) => [r.imageId, r.n]))
  const data = rows.map((r) => ({
    ...r,
    materialUses: matMap.get(r.id) ?? 0,
    qaUses: qaMap.get(r.id) ?? 0,
  }))
  return ok(data)
}

const createSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video']).default('image'),
  name: z.string().trim().min(1),
  description: z.string().trim().default(''),
  tags: z.array(z.string().trim().min(1)).default([]),
})

// POST — registra un medio ya subido a Blob (lo embebe por su texto)
export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Faltan datos: url y name son obligatorios.')
  const { url, type, name, description, tags } = parsed.data

  const embedding = await embed(embedText(name, description, tags))
  const [row] = await db
    .insert(images)
    .values({ url, type, name, description, tags, embedding })
    .returning({ id: images.id })
  return ok({ id: row.id })
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
})

// PATCH — edita metadatos; si cambian, re-embebe
export async function PATCH(req: Request) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Datos inválidos.')
  const { id, name, description, tags } = parsed.data

  const [cur] = await db.select().from(images).where(eq(images.id, id))
  if (!cur) return fail('La imagen no existe.', 404, 'NOT_FOUND')

  const next = {
    name: name ?? cur.name,
    description: description ?? cur.description,
    tags: (tags ?? (cur.tags as string[])) as string[],
  }
  const embedding = await embed(embedText(next.name, next.description, next.tags))
  await db
    .update(images)
    .set({ ...next, embedding, updatedAt: new Date() })
    .where(eq(images.id, id))
  return ok({ id })
}

// DELETE — borra la imagen (blob + fila)
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id.')
  const [row] = await db.select({ url: images.url }).from(images).where(eq(images.id, id))
  if (!row) return fail('La imagen no existe.', 404, 'NOT_FOUND')
  try {
    await del(row.url)
  } catch {
    /* el blob ya no existe: seguimos */
  }
  await db.delete(images).where(eq(images.id, id))
  return ok({ deleted: id })
}
