import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

/**
 * Token firmado para subir medios (imágenes y videos cortos) DIRECTO del navegador
 * a Vercel Blob con `access: 'private'` — el store está configurado como privado.
 * Los medios se exponen públicamente a Meta vía el proxy GET /api/media/<id>, que
 * lee el blob privado con el token y lo transmite. Bajo /api/panel/* → Clerk. El
 * registro (embeddings) lo hace el cliente al terminar vía POST /api/panel/images.
 */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/3gpp',
]
// 16 MB: límite de WhatsApp para enviar video por URL.
const MAX_SIZE = 16 * 1024 * 1024

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => ({
        access: 'private',
        addRandomSuffix: true,
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_SIZE,
      }),
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al generar el token de subida'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
