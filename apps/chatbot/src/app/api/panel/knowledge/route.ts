import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema'
import { inngest } from '@/inngest/client'

/**
 * Fuentes de conocimiento. El flujo de alta es en dos pasos:
 *  1) POST /api/panel/knowledge/parse → extrae el texto para previsualizar/editar.
 *  2) POST aquí con { name, type, content } → crea la fuente con el texto YA
 *     revisado y dispara la ingesta (chunk + embed desde `content`).
 * Se guarda solo texto plano (el blob original se borra) → menos almacenamiento y
 * fuente de verdad editable. PATCH reedita y re-ingiere en sitio.
 */

const SOURCE_TYPES = ['pdf', 'docx', 'pptx', 'txt', 'link', 'faq'] as const

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

async function triggerIngest(sourceId: string) {
  await inngest.send({ name: 'ingest/source.uploaded', data: { sourceId } })
}

// Borra un blob de Vercel (best-effort): si ya no existe o no es nuestro, seguimos.
async function deleteBlobQuietly(url: string | null | undefined) {
  if (!url) return
  try {
    await del(url)
  } catch {
    /* el blob ya no existe o no es accesible: ignorar */
  }
}

// GET — lista de fuentes, o una sola (?id=) con su texto plano para editar.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const [src] = await db
      .select({
        id: knowledgeSources.id,
        type: knowledgeSources.type,
        name: knowledgeSources.name,
        content: knowledgeSources.content,
        status: knowledgeSources.status,
        priority: knowledgeSources.priority,
      })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, id))
    if (!src) return fail('La fuente no existe.', 404, 'NOT_FOUND')
    return ok(src)
  }

  const sources = await db
    .select({
      id: knowledgeSources.id,
      type: knowledgeSources.type,
      name: knowledgeSources.name,
      status: knowledgeSources.status,
      error: knowledgeSources.error,
      chunkCount: knowledgeSources.chunkCount,
      createdAt: knowledgeSources.createdAt,
      updatedAt: knowledgeSources.updatedAt,
    })
    .from(knowledgeSources)
    .orderBy(desc(knowledgeSources.createdAt))
  return ok(sources)
}

// POST — crea una fuente con el texto plano ya revisado y dispara la ingesta.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = z
    .object({
      name: z.string().trim().min(1),
      type: z.enum(SOURCE_TYPES),
      content: z.string().trim().min(1),
      priority: z.coerce.number().int().min(0).max(10).optional(),
      // Para links guardamos la URL como referencia; para archivos llega el
      // blobUrl solo para borrarlo (no se persiste: la verdad es `content`).
      originalUrl: z.string().url().nullish(),
    })
    .safeParse(body)
  if (!parsed.success) return fail('Faltan datos: name, type y content son obligatorios.')
  const { name, type, content, priority, originalUrl } = parsed.data

  const [source] = await db
    .insert(knowledgeSources)
    .values({
      type,
      name,
      content,
      priority: priority ?? 0,
      // Solo conservamos URL para links; los archivos guardan solo texto plano.
      originalUrl: type === 'link' ? (originalUrl ?? null) : null,
      status: 'pending',
    })
    .returning({ id: knowledgeSources.id })

  // Archivo: el texto ya está en `content`, el blob original sobra → borrarlo.
  if (type !== 'link' && originalUrl) await deleteBlobQuietly(originalUrl)

  await triggerIngest(source.id)
  return ok({ sourceId: source.id, status: 'pending' })
}

// PATCH — edita nombre/contenido de una fuente y re-ingiere en sitio.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).optional(),
      content: z.string().trim().min(1).optional(),
      priority: z.coerce.number().int().min(0).max(10).optional(),
    })
    .safeParse(body)
  if (!parsed.success) return fail('Envía id y al menos name, content o priority.')
  const { id, name, content, priority } = parsed.data
  if (name === undefined && content === undefined && priority === undefined)
    return fail('Nada que actualizar.')

  const [src] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, id))
  if (!src) return fail('La fuente no existe.', 404, 'NOT_FOUND')

  await db
    .update(knowledgeSources)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(priority !== undefined ? { priority } : {}),
      // Cambiar el texto → re-ingerir (el job re-trocea desde `content`).
      ...(content !== undefined ? { content, status: 'pending', error: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeSources.id, id))

  if (content !== undefined) await triggerIngest(id)
  return ok({ id, reingested: content !== undefined })
}

// DELETE — borrar fuente (cascade a chunks) + su blob si lo tuviera
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id de la fuente.')

  const [src] = await db
    .select({ originalUrl: knowledgeSources.originalUrl, type: knowledgeSources.type })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, id))
  if (!src) return fail('La fuente no existe.', 404, 'NOT_FOUND')

  if (src.originalUrl && src.type !== 'link') await deleteBlobQuietly(src.originalUrl)
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id))
  return ok({ deleted: id })
}
