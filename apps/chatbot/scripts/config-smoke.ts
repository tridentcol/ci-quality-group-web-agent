/**
 * Smoke del API de configuración del bot (Step 12). Ejerce GET/PATCH del
 * handler (auth en proxy.ts) y restaura los valores originales de bot_config.
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/config-smoke.ts
 */
import { GET, PATCH } from '../src/app/api/panel/config/route'

const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${msg}`)
  if (!cond) process.exitCode = 1
}
const patchReq = (body: unknown) =>
  new Request('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const read = async (r: Response) => ({ status: r.status, body: await r.json() })

// Horario por día (schedule[0..6] = domingo..sábado, null = cerrado) — esquema
// vigente desde el PR #17 (antes era {days,open,close}, ya no existe).
const WD = { open: '08:00', close: '18:00' }
const schedule = [null, WD, WD, WD, WD, WD, WD]

async function main() {
  const orig = (await read(await GET())).body.data
  assert(!!orig && orig.id === 1, 'config GET devuelve bot_config (id=1)')

  try {
    const upd = await read(
      await PATCH(patchReq({
        botName: 'Bot de Prueba SMOKE',
        maxAutoDiscountPct: 7,
        retentionMonths: 24,
        channelsEnabled: { messenger: true, whatsapp: true, instagram: false },
        businessHours: { schedule, holidays: [] },
      })),
    )
    assert(
      upd.body.data?.botName === 'Bot de Prueba SMOKE' &&
        upd.body.data?.maxAutoDiscountPct === '7' &&
        upd.body.data?.retentionMonths === 24 &&
        upd.body.data?.channelsEnabled?.instagram === false &&
        upd.body.data?.businessHours?.schedule?.[1]?.close === '18:00',
      'config PATCH actualiza nombre, descuento, retención, canales y horario',
    )

    const badSchedule = [null, { open: '8am', close: '18:00' }, null, null, null, null, null]
    const badTime = await read(await PATCH(patchReq({ businessHours: { schedule: badSchedule } })))
    assert(badTime.status === 400, 'config PATCH rechaza hora inválida (400)')

    const badDisc = await read(await PATCH(patchReq({ maxAutoDiscountPct: 150 })))
    assert(badDisc.status === 400, 'config PATCH rechaza descuento > 100 (400)')
  } finally {
    // Restaurar valores originales.
    await PATCH(patchReq({
      botName: orig.botName,
      tonePrompt: orig.tonePrompt,
      welcomeMessage: orig.welcomeMessage,
      afterHoursMessage: orig.afterHoursMessage,
      businessHours: orig.businessHours,
      channelsEnabled: orig.channelsEnabled,
      adminWhatsapp: orig.adminWhatsapp,
      retentionMonths: orig.retentionMonths,
      maxAutoDiscountPct: Number(orig.maxAutoDiscountPct),
    }))
    console.log('— configuración restaurada —')
  }

  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
