import { eq } from 'drizzle-orm'
import { db } from './index'
import { leads } from './schema'

/**
 * Siembra de leads de PRUEBA para visualizar el pipeline/kanban y el dashboard.
 * - Todos con test=true → badge "Prueba", no notifican, y se pueden ocultar/borrar.
 * - Repartidos por todas las columnas (new→lost) y por canal.
 * - Algunos con createdAt antiguo → muestran el badge ⏳ de "estancado" (≥3 días).
 *
 * Ejecutar:  pnpm --filter chatbot tsx src/lib/db/seed-leads.ts
 * Borrar todo lo de prueba luego:  pnpm --filter chatbot tsx src/lib/db/seed-leads.ts --clean
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

const SAMPLE = [
  { name: 'Ferretería El Tornillo', contact: '+57 312 555 0142', interest: 'Chatarra de hierro', channel: 'messenger', status: 'new', quantity: '800', unit: 'kg', age: 0 },
  { name: 'Constructora Andina', contact: '+57 301 555 0188', interest: 'Cobre #2', channel: 'whatsapp', status: 'new', quantity: '120', unit: 'kg', age: 5, requestedDiscount: true },
  { name: 'Taller Mecánico Rojas', contact: '+57 320 555 0117', interest: 'Aluminio perfil', channel: 'messenger', status: 'contacted', quantity: '300', unit: 'kg', age: 1 },
  { name: 'Recicladora La 50', contact: 'ventas@recicladorala50.co', interest: 'Chatarra mixta', channel: 'instagram', status: 'contacted', quantity: '1500', unit: 'kg', age: 4 },
  { name: 'Metales del Valle', contact: '+57 315 555 0193', interest: 'Bronce', channel: 'whatsapp', status: 'quoted', quantity: '90', unit: 'kg', agreedPriceCop: '1350000', age: 2 },
  { name: 'Industrias Caribe', contact: '+57 300 555 0166', interest: 'Disposición de desechos', channel: 'messenger', status: 'quoted', quantity: '2', unit: 'ton', agreedPriceCop: '4200000', age: 6 },
  { name: 'Chatarrería San José', contact: '+57 318 555 0150', interest: 'Cobre #1', channel: 'whatsapp', status: 'ready', quantity: '60', unit: 'kg', agreedPriceCop: '1980000', fulfillment: 'Recogemos en bodega', scheduledFor: 'martes en la mañana', paymentMethod: 'transferencia', age: 2 },
  { name: 'Autopartes González', contact: '+57 314 555 0124', interest: 'Radiadores aluminio-cobre', channel: 'messenger', status: 'ready', quantity: '45', unit: 'kg', agreedPriceCop: '720000', fulfillment: 'Lleva a planta', scheduledFor: 'esta semana', paymentMethod: 'efectivo', age: 1 },
  { name: 'Demoliciones Bogotá', contact: '+57 311 555 0179', interest: 'Hierro estructural', channel: 'whatsapp', status: 'won', quantity: '3', unit: 'ton', agreedPriceCop: '5400000', fulfillment: 'Recogemos en obra', paymentMethod: 'transferencia', age: 3 },
  { name: 'Tornillos y Más', contact: '+57 319 555 0133', interest: 'Acero inoxidable', channel: 'messenger', status: 'won', quantity: '210', unit: 'kg', agreedPriceCop: '2730000', paymentMethod: 'efectivo', age: 8 },
  { name: 'Cliente sin presupuesto', contact: '+57 313 555 0101', interest: 'Aluminio', channel: 'instagram', status: 'lost', quantity: '50', unit: 'kg', notes: 'Buscaba precio muy por encima del mercado.', age: 7 },
] as const

async function clean() {
  await db.delete(leads).where(eq(leads.test, true))
  console.log('🧹 Leads de prueba borrados.')
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean()
    process.exit(0)
  }

  const rows = SAMPLE.map((s) => ({
    name: s.name,
    contact: s.contact,
    interest: s.interest,
    quantity: s.quantity,
    unit: s.unit,
    status: s.status,
    test: true,
    requestedDiscount: 'requestedDiscount' in s ? s.requestedDiscount : false,
    agreedPriceCop: 'agreedPriceCop' in s ? s.agreedPriceCop : null,
    fulfillment: 'fulfillment' in s ? s.fulfillment : null,
    scheduledFor: 'scheduledFor' in s ? s.scheduledFor : null,
    paymentMethod: 'paymentMethod' in s ? s.paymentMethod : null,
    notes: 'notes' in s ? s.notes : null,
    createdAt: daysAgo(s.age),
  }))

  await db.insert(leads).values(rows)
  console.log(`✅ ${rows.length} leads de prueba creados (test=true). Repartidos en todas las columnas.`)
  console.log('   Para borrarlos: pnpm --filter chatbot tsx src/lib/db/seed-leads.ts --clean')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
