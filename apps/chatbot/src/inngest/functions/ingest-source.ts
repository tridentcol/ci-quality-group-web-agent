import { eq } from 'drizzle-orm'
import { get } from '@vercel/blob'
import { inngest } from '@/inngest/client'
import { db } from '@/lib/db'
import { botConfig, knowledgeChunks, knowledgeQa, knowledgeSources } from '@/lib/db/schema'
import { parseDocument, type ParseableType } from '@/lib/ingest/parse'
import { scrapeUrl } from '@/lib/ingest/scrape'
import { chunkText } from '@/lib/ingest/chunk'
import { embedBatch } from '@/lib/ai/embed'
import { generateQa } from '@/lib/ai/qa-extract'
import { logEvent } from '@/lib/log'

const EMBED_BATCH = 96 // tamaño de lote para embeddings

/**
 * Job de ingesta (blueprint §9 Step 5): descarga del Blob (o scrape de link) →
 * parse → chunk → embed → insertar chunks → status `ready` (o `failed`).
 */
export const ingestSource = inngest.createFunction(
  {
    id: 'ingest-source',
    name: 'Ingesta de fuente de conocimiento',
    triggers: [{ event: 'ingest/source.uploaded' }],
  },
  async ({ event, step }) => {
    const { sourceId } = event.data

    const source = await step.run('load-source', async () => {
      const [row] = await db
        .select()
        .from(knowledgeSources)
        .where(eq(knowledgeSources.id, sourceId))
      if (!row) throw new Error(`knowledge_source ${sourceId} no existe`)
      return row
    })

    // ¿Generar preguntas frecuentes (Q&A)? Toggle de costo en bot_config.
    const qaEnabled = await step.run('load-qa-flag', async () => {
      const [cfg] = await db
        .select({ on: botConfig.qaGenerationEnabled })
        .from(botConfig)
        .where(eq(botConfig.id, 1))
      return cfg?.on ?? true
    })

    await step.run('mark-processing', async () => {
      await db
        .update(knowledgeSources)
        .set({ status: 'processing', error: null })
        .where(eq(knowledgeSources.id, sourceId))
    })

    try {
      // 1) Obtener texto. Si la fuente ya tiene `content` (texto plano revisado
      //    por el admin), se usa directo: es el camino de re-ingesta tras editar
      //    y no re-parsea. Si no, se descarga/scrapea/parsea y se GUARDA en
      //    `content` para que sea editable y no haya que re-parsear nunca más.
      const text = await step.run('extract-text', async () => {
        if (source.content && source.content.trim()) return source.content

        if (!source.originalUrl) throw new Error('La fuente no tiene contenido ni originalUrl')
        const extracted =
          source.type === 'link'
            ? await scrapeUrl(source.originalUrl)
            : await (async () => {
                // Blob privado: se descarga autenticado con BLOB_READ_WRITE_TOKEN.
                const blob = await get(source.originalUrl!, { access: 'private' })
                if (!blob || blob.statusCode !== 200 || !blob.stream) {
                  throw new Error('No se pudo descargar el blob privado')
                }
                const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer())
                return parseDocument(buffer, source.type as ParseableType)
              })()

        // Persistir el texto extraído como canónico.
        await db
          .update(knowledgeSources)
          .set({ content: extracted })
          .where(eq(knowledgeSources.id, sourceId))
        return extracted
      })

      // 2) Trocear
      const chunks = chunkText(text)
      if (chunks.length === 0) throw new Error('El documento no produjo texto utilizable')

      // 3) Reemplazo idempotente: borrar chunks viejos del source y reinsertar.
      //    Así editar/re-ingerir actualiza en sitio, sin duplicados obsoletos.
      await step.run('replace-chunks', async () => {
        await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId))
        for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
          const batch = chunks.slice(i, i + EMBED_BATCH)
          const embeddings = await embedBatch(batch)
          await db.insert(knowledgeChunks).values(
            batch.map((content, j) => ({
              sourceId,
              content,
              embedding: embeddings[j],
              metadata: { index: i + j },
            })),
          )
        }
      })

      // 4) Q&A: generar preguntas frecuentes del documento, embeber las preguntas
      //    y reemplazar (idempotente). No es crítico: si falla, la fuente queda
      //    igualmente `ready` con sus chunks; solo se pierde el extra de Q&A.
      const qaCount = await step.run('extract-qa', async () => {
        await db.delete(knowledgeQa).where(eq(knowledgeQa.sourceId, sourceId))
        if (!qaEnabled) return 0
        try {
          const { pairs, truncated } = await generateQa(text)
          if (truncated) {
            // El RAG normal (chunks) sí cubre el documento completo; las FAQ
            // generadas no, si el documento pasa el tope de caracteres — antes
            // esto no quedaba registrado en ningún lado.
            await logEvent(
              'warning',
              'ingest',
              `"${source.name}" es más largo que el tope de generación de preguntas: las FAQ generadas cubren solo el inicio del documento (el RAG normal sí lo cubre completo).`,
              { sourceId },
            )
          }
          if (pairs.length === 0) return 0
          const embeddings = await embedBatch(pairs.map((p) => p.question))
          await db.insert(knowledgeQa).values(
            pairs.map((p, i) => ({
              sourceId,
              question: p.question,
              answer: p.answer,
              embedding: embeddings[i],
            })),
          )
          return pairs.length
        } catch (e) {
          console.error(`extract-qa falló para ${sourceId}:`, e)
          return 0
        }
      })

      await step.run('mark-ready', async () => {
        await db
          .update(knowledgeSources)
          .set({
            status: 'ready',
            chunkCount: chunks.length,
            qaCount,
            updatedAt: new Date(),
          })
          .where(eq(knowledgeSources.id, sourceId))
      })

      return { sourceId, chunks: chunks.length, qa: qaCount, status: 'ready' as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await step.run('mark-failed', async () => {
        await db
          .update(knowledgeSources)
          .set({ status: 'failed', error: message })
          .where(eq(knowledgeSources.id, sourceId))
      })
      // Antes esto solo quedaba en knowledge_sources.error — el admin solo se
      // enteraba si entraba manualmente a la pestaña Conocimiento. Ahora también
      // aparece en el Panel de salud (hallazgo de auditoría: una fuente atascada
      // en pending/failed podía pasar inadvertida indefinidamente).
      await logEvent('error', 'ingest', `Falló la ingesta de "${source.name}": ${message}`, { sourceId })
      throw err
    }
  },
)
