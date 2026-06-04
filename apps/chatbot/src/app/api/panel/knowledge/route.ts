import { NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema'
import { inngest } from '@/inngest/client'
import type { ParseableType } from '@/lib/ingest/parse'

const EXT_TO_TYPE: Record<string, ParseableType> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  pptx: 'pptx',
  ppt: 'pptx',
  txt: 'txt',
  md: 'txt',
}

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

async function triggerIngest(sourceId: string) {
  await inngest.send({ name: 'ingest/source.uploaded', data: { sourceId } })
}

// GET — lista de fuentes
export async function GET() {
  const sources = await db
    .select({
      id: knowledgeSources.id,
      type: knowledgeSources.type,
      name: knowledgeSources.name,
      status: knowledgeSources.status,
      error: knowledgeSources.error,
      createdAt: knowledgeSources.createdAt,
    })
    .from(knowledgeSources)
    .orderBy(desc(knowledgeSources.createdAt))
  return ok(sources)
}

// POST — subir archivo (multipart) o link/texto (JSON)
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''

  // 1) Archivo
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return fail('Falta el archivo a subir.')

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const type = EXT_TO_TYPE[ext]
    if (!type) return fail(`Tipo no soportado: .${ext}. Usa PDF, DOCX, PPTX o TXT.`)

    const blob = await put(`knowledge/${file.name}`, file, {
      access: 'private',
      addRandomSuffix: true,
    })
    const [source] = await db
      .insert(knowledgeSources)
      .values({ type, name: file.name, originalUrl: blob.url, status: 'pending' })
      .returning({ id: knowledgeSources.id })
    await triggerIngest(source.id)
    return ok({ sourceId: source.id, status: 'pending' })
  }

  // 2) Link o texto (JSON)
  const body = await req.json().catch(() => null)
  const parsed = z
    .object({
      url: z.string().url().optional(),
      text: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1).optional(),
    })
    .safeParse(body)
  if (!parsed.success) return fail('Envía un archivo, una URL o texto.')
  const { url, text, name } = parsed.data

  if (url) {
    const [source] = await db
      .insert(knowledgeSources)
      .values({ type: 'link', name: name ?? url, originalUrl: url, status: 'pending' })
      .returning({ id: knowledgeSources.id })
    await triggerIngest(source.id)
    return ok({ sourceId: source.id, status: 'pending' })
  }

  if (text) {
    const blob = await put(`knowledge/${name ?? 'texto'}.txt`, text, {
      access: 'private',
      addRandomSuffix: true,
      contentType: 'text/plain; charset=utf-8',
    })
    const [source] = await db
      .insert(knowledgeSources)
      .values({ type: 'txt', name: name ?? 'Texto pegado', originalUrl: blob.url, status: 'pending' })
      .returning({ id: knowledgeSources.id })
    await triggerIngest(source.id)
    return ok({ sourceId: source.id, status: 'pending' })
  }

  return fail('Envía un archivo, una URL o texto.')
}

// DELETE — borrar fuente (cascade a chunks) + su blob
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return fail('Falta el id de la fuente.')

  const [src] = await db
    .select({ originalUrl: knowledgeSources.originalUrl, type: knowledgeSources.type })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, id))
  if (!src) return fail('La fuente no existe.', 404, 'NOT_FOUND')

  // Borra el blob (no aplica a links)
  if (src.originalUrl && src.type !== 'link') {
    try {
      await del(src.originalUrl)
    } catch {
      // si el blob ya no existe, seguimos borrando la fila
    }
  }
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id))
  return ok({ deleted: id })
}
