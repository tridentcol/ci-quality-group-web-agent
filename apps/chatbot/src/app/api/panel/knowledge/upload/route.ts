import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

/**
 * Emite el token firmado para subir archivos de conocimiento DIRECTO del
 * navegador a Vercel Blob (client upload). Así los bytes no pasan por la
 * función serverless, que corta el body en 4.5 MB → evita el 413.
 *
 * Vive bajo /api/panel/* → protegido por Clerk (proxy.ts). El registro de la
 * fuente + disparo de Inngest los hace el cliente al terminar, vía
 * POST /api/panel/knowledge { blobUrl, name } (ver knowledge/route.ts).
 */

// Tipos MIME aceptados (PDF, DOCX/DOC, PPTX/PPT, TXT/MD). Generoso a propósito:
// la validación fina por extensión la hace el paso de confirmación.
const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/octet-stream', // algunos navegadores no infieren el MIME de .md/.txt
]

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

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
      // Sin onUploadCompleted: el cliente confirma la subida (funciona también
      // en local, donde Blob no puede alcanzar localhost).
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al generar el token de subida'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
