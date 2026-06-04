/**
 * Smoke del API de Precios (Step 7): ejerce los handlers de
 * src/app/api/panel/pricing/route.ts (POST→GET→PATCH→DELETE) sin pasar por
 * Clerk (la auth vive en proxy.ts, no en el handler). Limpia lo que crea.
 *
 * Uso: pnpm --filter chatbot exec tsx --env-file=.env.local scripts/pricing-smoke.ts
 */
import { GET, POST, PATCH, DELETE } from '../src/app/api/panel/pricing/route'

const json = (body: unknown) =>
  new Request('http://localhost/api/panel/pricing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

async function read(res: Response) {
  return { status: res.status, body: await res.json() }
}

async function main() {
  // 1) crear
  const created = await read(
    await POST(json({ name: 'SMOKE Cobre #1', category: 'No ferroso', unit: 'kg', retailPriceCop: 28000, wholesalePriceCop: 26500, wholesaleThreshold: 100 })),
  )
  console.log('POST', created.status, JSON.stringify(created.body.data ?? created.body))
  const id = created.body.data.id as string

  // 2) validación: precio negativo debe fallar
  const bad = await read(await POST(json({ name: 'X', unit: 'kg', retailPriceCop: -5 })))
  console.log('POST inválido (esperado 400):', bad.status, bad.body.error?.message)

  // 3) listar
  const list = await read(await GET())
  const found = (list.body.data as Array<{ id: string }>).some((m) => m.id === id)
  console.log('GET count:', list.body.data.length, '| incluye creado:', found)

  // 4) actualizar precio + desactivar
  const patched = await read(
    await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, retailPriceCop: 30000, active: false }),
      }),
    ),
  )
  console.log('PATCH', patched.status, 'retail=', patched.body.data?.retailPriceCop, 'active=', patched.body.data?.active)

  // 5) borrar (limpieza)
  const del = await read(
    await DELETE(new Request(`http://localhost/api/panel/pricing?id=${id}`, { method: 'DELETE' })),
  )
  console.log('DELETE', del.status, JSON.stringify(del.body.data ?? del.body))

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
