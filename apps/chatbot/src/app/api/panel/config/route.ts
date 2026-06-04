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
    businessHours: z
      .object({
        days: z.array(z.number().int().min(0).max(6)),
        open: z.string().regex(HHMM, 'Hora inválida (HH:MM).'),
        close: z.string().regex(HHMM, 'Hora inválida (HH:MM).'),
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
    retentionMonths: z.coerce.number().int().min(1).max(120).optional(),
    maxAutoDiscountPct: z.coerce.number().min(0).max(100).optional(),
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
  if (d.retentionMonths !== undefined) set.retentionMonths = d.retentionMonths
  if (d.maxAutoDiscountPct !== undefined) set.maxAutoDiscountPct = String(d.maxAutoDiscountPct)

  const [row] = await db.update(botConfig).set(set).where(eq(botConfig.id, 1)).returning()
  if (!row) return fail('bot_config no inicializado (corre el seed).', 404, 'NOT_FOUND')
  return ok(row)
}
