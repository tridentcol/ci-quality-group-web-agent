import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { images } from '@/lib/db/schema'
import { env } from '@/lib/env'

/**
 * Proxy PÚBLICO de medios. El store de Blob es privado, pero Meta
 * (WhatsApp/Messenger/Instagram) y el panel necesitan una URL pública para
 * descargar la imagen/video. Esta ruta (fuera de /api/panel → sin Clerk) busca el
 * medio por id, lee el blob PRIVADO con el token de servidor y lo transmite con el
 * Content-Type correcto. La respuesta se cachea en el CDN para no re-pedir el blob
 * en cada envío. Los medios son contenido pensado para clientes, así que su entrega
 * pública es intencional; el id es un UUID no adivinable.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return new Response('Not found', { status: 404 })

  const [row] = await db
    .select({ blobUrl: images.blobUrl, type: images.type })
    .from(images)
    .where(eq(images.id, id))
  if (!row?.blobUrl) return new Response('Not found', { status: 404 })

  // El blob privado se accede con Authorization: Bearer <BLOB_READ_WRITE_TOKEN>.
  const upstream = await fetch(row.blobUrl, {
    headers: { Authorization: `Bearer ${env.BLOB_READ_WRITE_TOKEN ?? ''}` },
  })
  if (!upstream.ok || !upstream.body) return new Response('Not found', { status: 404 })

  const headers = new Headers({
    'Content-Type':
      upstream.headers.get('content-type') ?? (row.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    // 7 días en CDN; id↔blob es 1:1 (borrar el medio elimina la fila), por eso immutable.
    'Cache-Control': 'public, max-age=604800, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  const len = upstream.headers.get('content-length')
  if (len) headers.set('Content-Length', len)

  return new Response(upstream.body, { status: 200, headers })
}
