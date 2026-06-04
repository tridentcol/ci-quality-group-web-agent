/**
 * Smoke de ingesta (cierre Step 6): replica la ruta de "texto pegado" de
 * /api/panel/knowledge sin pasar por Clerk → sube a Blob, inserta la fuente y
 * dispara el evento Inngest. Luego puedes verificar que la fuente pasa a `ready`
 * y que se crearon chunks. Requiere: dev server (:3000) + Inngest Dev Server
 * (:8288) + INNGEST_DEV=1 + BLOB_READ_WRITE_TOKEN.
 *
 * Uso: pnpm --filter chatbot exec tsx scripts/ingest-smoke.ts
 */
import { put } from '@vercel/blob'
import { db } from '../src/lib/db'
import { knowledgeSources } from '../src/lib/db/schema'
import { inngest } from '../src/inngest/client'

const TEXT = `CI Quality Group — Servicios (documento de prueba de ingesta).

CI Quality Group es una empresa colombiana dedicada a la disposición final de
desechos, la chatarrización de vehículos y la compra y venta de chatarra.

Servicios principales:
- Chatarrización certificada de vehículos para cancelación de matrícula.
- Compra de chatarra ferrosa y no ferrosa (hierro, cobre, aluminio, bronce).
- Disposición final de desechos industriales con cumplimiento ambiental.

Horario de atención: lunes a viernes de 7:00 a.m. a 5:00 p.m.
Cobertura: Bogotá y municipios aledaños.`

async function main() {
  const name = `Smoke ingesta ${new Date().toISOString()}`
  const blob = await put(`knowledge/smoke-${Date.now()}.txt`, TEXT, {
    access: 'private',
    addRandomSuffix: true,
    contentType: 'text/plain; charset=utf-8',
  })

  const [source] = await db
    .insert(knowledgeSources)
    .values({ type: 'txt', name, originalUrl: blob.url, status: 'pending' })
    .returning({ id: knowledgeSources.id })

  await inngest.send({ name: 'ingest/source.uploaded', data: { sourceId: source.id } })

  console.log(JSON.stringify({ sourceId: source.id, blobUrl: blob.url, status: 'pending' }))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
