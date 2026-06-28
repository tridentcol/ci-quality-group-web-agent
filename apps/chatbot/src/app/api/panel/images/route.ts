import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { count, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { images, knowledgeQa, materials } from '@/lib/db/schema'
import { embed } from '@/lib/ai/embed'
import { env } from '@/lib/env'
import { isVercelBlobUrl } from '@/lib/blob-name'

// Base pública absoluta para la URL del proxy. Se prefiere APP_URL si es un https
// real (config de prod); si no, se deriva del host de la petición (el dominio por el
// que entra el admin = el dominio público del bot). Así la URL que recibe Meta es
// siempre absoluta y alcanzable, sin depender de que APP_URL esté bien configurada.
function publicBase(req: Request): string {
  const appUrl = (env.APP_URL ?? '').replace(/\/$/, '')
  if (/^https:\/\//.test(appUrl) && !appUrl.includes('localhost')) return appUrl
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

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
  // Debe ser una URL de Vercel Blob: el proxy reenvía el token solo a ese dominio.
  url: z.string().url().refine(isVercelBlobUrl, 'La URL no es de Vercel Blob.'),
  type: z.enum(['image', 'video']).default('image'),
  name: z.string().trim().min(1),
  description: z.string().trim().default(''),
  tags: z.array(z.string().trim().min(1)).default([]),
})

// POST — registra un medio ya subido a Blob (lo embebe por su texto)
export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Faltan datos: url y name.')
  const { url, type, name, description, tags } = parsed.data

  const embedding = await embed(embedText(name, description, tags))
  // Insert ATÓMICO: el id se genera en la app para fijar la url del proxy en la MISMA
  // fila, sin el paso intermedio que podía dejar url='' permanente si fallaba el update.
  // `url` del cliente es el blob PRIVADO → blobUrl; la url pública es el proxy.
  const id = crypto.randomUUID()
  const publicUrl = `${publicBase(req)}/api/media/${id}`
  await db
    .insert(images)
    .values({ id, url: publicUrl, blobUrl: url, type, name, description, tags, embedding })
  return ok({ id, url: publicUrl })
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
  const [row] = await db.select({ blobUrl: images.blobUrl }).from(images).where(eq(images.id, id))
  if (!row) return fail('La imagen no existe.', 404, 'NOT_FOUND')
  if (row.blobUrl) {
    try {
      await del(row.blobUrl) // borra el blob PRIVADO real (no la URL proxy)
    } catch {
      /* el blob ya no existe: seguimos */
    }
  }
  await db.delete(images).where(eq(images.id, id))
  return ok({ deleted: id })
}
