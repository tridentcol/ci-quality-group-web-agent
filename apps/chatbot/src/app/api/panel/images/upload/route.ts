import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

/**
 * Token firmado para subir imágenes DIRECTO del navegador a Vercel Blob, con
 * `access: 'public'` — las imágenes deben tener URL pública para que Meta
 * (WhatsApp/Messenger/Instagram) pueda descargarlas al adjuntarlas. Bajo
 * /api/panel/* → protegido por Clerk. El registro (embeddings) lo hace el cliente
 * al terminar vía POST /api/panel/images { url, name, description, tags }.
 */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => ({
        access: 'public',
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
