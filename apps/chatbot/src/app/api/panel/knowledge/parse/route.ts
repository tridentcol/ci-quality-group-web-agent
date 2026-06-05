import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { z } from 'zod'
import { parseDocument, type ParseableType } from '@/lib/ingest/parse'
import { scrapeUrl } from '@/lib/ingest/scrape'

/**
 * Extrae el texto de un archivo (ya subido a Blob), un link o texto pegado y lo
 * DEVUELVE para previsualizarlo/editarlo, SIN crear la fuente ni disparar la
 * ingesta. El admin revisa/corrige y luego confirma con POST /api/panel/knowledge
 * { name, type, content }. Vive bajo /api/panel/* → protegido por Clerk.
 */

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = z
    .object({
      blobUrl: z.string().url().optional(),
      url: z.string().url().optional(),
      text: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1).optional(),
    })
    .safeParse(body)
  if (!parsed.success) return fail('Envía un archivo, una URL o texto.')
  const { blobUrl, url, text, name } = parsed.data

  try {
    // 1) Archivo ya subido a Blob por el cliente → descargar y parsear
    if (blobUrl) {
      if (!name) return fail('Falta el nombre del archivo.')
      const ext = name.split('.').pop()?.toLowerCase() ?? ''
      const type = EXT_TO_TYPE[ext]
      if (!type) return fail(`Tipo no soportado: .${ext}. Usa PDF, DOCX, PPTX o TXT.`)

      const blob = await get(blobUrl, { access: 'private' })
      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        return fail('No se pudo descargar el archivo subido.', 502, 'BLOB')
      }
      const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer())
      const content = await parseDocument(buffer, type)
      return ok({ type, name, content, originalUrl: blobUrl })
    }

    // 2) Link → scrape
    if (url) {
      const content = await scrapeUrl(url)
      return ok({ type: 'link', name: name ?? url, content, originalUrl: url })
    }

    // 3) Texto pegado → ya es plano
    if (text) {
      return ok({ type: 'txt', name: name ?? 'Texto pegado', content: text, originalUrl: null })
    }

    return fail('Envía un archivo, una URL o texto.')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'No se pudo extraer el texto.', 422, 'PARSE')
  }
}
