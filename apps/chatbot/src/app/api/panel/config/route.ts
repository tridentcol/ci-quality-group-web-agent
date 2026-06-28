import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { botConfig } from '@/lib/db/schema'

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}
function fail(message: string, status = 400, code = 'VALIDATION') {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// GET — configuración del bot (fila única id=1)
export async function GET() {
  const [cfg] = await db.select().from(botConfig).where(eq(botConfig.id, 1))
  if (!cfg) return fail('bot_config no inicializado (corre el seed).', 404, 'NOT_FOUND')
  return ok(cfg)
}

const patchSchema = z
  .object({
    botName: z.string().trim().min(1).optional(),
    tonePrompt: z.string().optional(),
    welcomeMessage: z.string().optional(),
    afterHoursMessage: z.string().optional(),
    // Horario POR DÍA (schedule[0..6], null=cerrado) + feriados (YYYY-MM-DD).
    businessHours: z
      .object({
        schedule: z
          .array(
            z
              .object({
                open: z.string().regex(HHMM, 'Hora inválida (HH:MM).'),
                close: z.string().regex(HHMM, 'Hora inválida (HH:MM).'),
              })
              .nullable(),
          )
          .length(7, 'El horario debe tener 7 días.'),
        holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD).')).optional(),
      })
      .nullable()
      .optional(),
    channelsEnabled: z
      .object({
        messenger: z.boolean(),
        whatsapp: z.boolean(),
        instagram: z.boolean(),
      })
      .optional(),
    adminWhatsapp: z.string().trim().nullable().optional(),
    locationName: z.string().trim().nullable().optional(),
    locationAddress: z.string().trim().nullable().optional(),
    locationLat: z.union([z.coerce.number().min(-90).max(90), z.null()]).optional(),
    locationLng: z.union([z.coerce.number().min(-180).max(180), z.null()]).optional(),
    locationMapsUrl: z.union([z.string().trim().url('Enlace de Maps inválido.'), z.literal(''), z.null()]).optional(),
    retentionMonths: z.coerce.number().int().min(1).max(120).optional(),
    maxAutoDiscountPct: z.coerce.number().min(0).max(100).optional(),
    qaGenerationEnabled: z.boolean().optional(),
    // Afinación (null = volver al valor por defecto del código).
    ragK: z.union([z.coerce.number().int().min(1).max(20), z.null()]).optional(),
    ragMinScore: z.union([z.coerce.number().min(0).max(1), z.null()]).optional(),
    mediaMinScore: z.union([z.coerce.number().min(0).max(1), z.null()]).optional(),
    temperature: z.union([z.coerce.number().min(0).max(1), z.null()]).optional(),
    maxAttachments: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
    extraInstructions: z.string().trim().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Nada que actualizar.')

// PATCH — actualiza la configuración del bot (parcial)
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  const d = parsed.data

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (d.botName !== undefined) set.botName = d.botName
  if (d.tonePrompt !== undefined) set.tonePrompt = d.tonePrompt
  if (d.welcomeMessage !== undefined) set.welcomeMessage = d.welcomeMessage
  if (d.afterHoursMessage !== undefined) set.afterHoursMessage = d.afterHoursMessage
  if (d.businessHours !== undefined) set.businessHours = d.businessHours
  if (d.channelsEnabled !== undefined) set.channelsEnabled = d.channelsEnabled
  if (d.adminWhatsapp !== undefined) set.adminWhatsapp = d.adminWhatsapp || null
  if (d.locationName !== undefined) set.locationName = d.locationName || null
  if (d.locationAddress !== undefined) set.locationAddress = d.locationAddress || null
  if (d.locationLat !== undefined) set.locationLat = d.locationLat === null ? null : String(d.locationLat)
  if (d.locationLng !== undefined) set.locationLng = d.locationLng === null ? null : String(d.locationLng)
  if (d.locationMapsUrl !== undefined) set.locationMapsUrl = d.locationMapsUrl || null
  if (d.retentionMonths !== undefined) set.retentionMonths = d.retentionMonths
  if (d.maxAutoDiscountPct !== undefined) set.maxAutoDiscountPct = String(d.maxAutoDiscountPct)
  if (d.qaGenerationEnabled !== undefined) set.qaGenerationEnabled = d.qaGenerationEnabled
  // Afinación: número→string para numeric; null se conserva (= usar default).
  if (d.ragK !== undefined) set.ragK = d.ragK
  if (d.ragMinScore !== undefined) set.ragMinScore = d.ragMinScore === null ? null : String(d.ragMinScore)
  if (d.mediaMinScore !== undefined) set.mediaMinScore = d.mediaMinScore === null ? null : String(d.mediaMinScore)
  if (d.temperature !== undefined) set.temperature = d.temperature === null ? null : String(d.temperature)
  if (d.maxAttachments !== undefined) set.maxAttachments = d.maxAttachments
  if (d.extraInstructions !== undefined) set.extraInstructions = d.extraInstructions || null

  const [row] = await db.update(botConfig).set(set).where(eq(botConfig.id, 1)).returning()
  if (!row) return fail('bot_config no inicializado (corre el seed).', 404, 'NOT_FOUND')
  return ok(row)
}
