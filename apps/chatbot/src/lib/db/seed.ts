import { sql } from 'drizzle-orm'
import { db } from './index'
import { botConfig, materials } from './schema'

/**
 * Semilla inicial (blueprint §9, Step 2):
 *  - bot_config singleton (id = 1) con tono/mensajes por defecto en español de Colombia.
 *  - materiales demo con precios en COP.
 * Idempotente: el config usa onConflictDoNothing; los materiales solo se insertan si la tabla está vacía.
 */
async function seed() {
  // 1) bot_config singleton
  await db
    .insert(botConfig)
    .values({
      id: 1,
      botName: 'Asistente de CI Quality Group',
      tonePrompt:
        'Responde con un tono natural, neutral, formal, profesional y directo, en español de Colombia. ' +
        'Sé claro y conciso, sin adornos ni exageración. No inventes información ni precios.',
      welcomeMessage:
        '¡Hola! Soy el asistente de CI Quality Group. Puedo ayudarte con disposición de desechos, ' +
        'chatarrización y compra/venta de chatarra. ¿En qué te puedo colaborar?',
      afterHoursMessage:
        'En este momento nuestro equipo no está disponible para atención personalizada, pero puedo ' +
        'ayudarte con tu consulta y dejar registrada tu solicitud para que te contacten pronto.',
      // schedule por día (0=dom … 6=sáb); null = cerrado. Forma que entiende isAfterHours.
      businessHours: {
        schedule: [
          null, // dom
          { open: '08:00', close: '18:00' }, // lun
          { open: '08:00', close: '18:00' }, // mar
          { open: '08:00', close: '18:00' }, // mié
          { open: '08:00', close: '18:00' }, // jue
          { open: '08:00', close: '18:00' }, // vie
          { open: '08:00', close: '12:00' }, // sáb
        ],
        holidays: [],
      },
      channelsEnabled: { messenger: true, whatsapp: true, instagram: true },
      retentionMonths: 12,
      maxAutoDiscountPct: '0',
    })
    .onConflictDoNothing({ target: botConfig.id })

  // 2) materiales demo (solo si la tabla está vacía)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(materials)

  if (count === 0) {
    await db.insert(materials).values([
      {
        name: 'Cobre #1',
        category: 'Metales no ferrosos',
        unit: 'kg',
        retailPriceCop: '28000',
        wholesalePriceCop: '30000',
        wholesaleThreshold: '100',
      },
      {
        name: 'Aluminio perfil',
        category: 'Metales no ferrosos',
        unit: 'kg',
        retailPriceCop: '6500',
        wholesalePriceCop: '7200',
        wholesaleThreshold: '200',
      },
      {
        name: 'Chatarra mixta (hierro)',
        category: 'Ferrosos',
        unit: 'kg',
        retailPriceCop: '900',
        wholesalePriceCop: '1100',
        wholesaleThreshold: '1000',
      },
      {
        name: 'Bronce',
        category: 'Metales no ferrosos',
        unit: 'kg',
        retailPriceCop: '18000',
        wholesalePriceCop: '19500',
        wholesaleThreshold: '100',
      },
      {
        name: 'Disposición final de desechos',
        category: 'Servicios',
        unit: 'ton',
        retailPriceCop: '150000',
        wholesalePriceCop: null,
        wholesaleThreshold: null,
      },
    ])
    console.log('✓ Insertados 5 materiales demo')
  } else {
    console.log(`• materials ya tiene ${count} filas; no se insertan demos`)
  }

  console.log('✓ Seed completado (bot_config + materiales)')
  process.exit(0)
}

seed().catch((err) => {
  console.error('✗ Seed falló:', err)
  process.exit(1)
})
