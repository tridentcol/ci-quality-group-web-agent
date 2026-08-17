import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { normalize } from "@/lib/ai/pricing";

/**
 * Importación masiva de precios. Hace UPSERT por nombre (insensible a mayúsculas):
 * si ya existe un material con ese nombre lo actualiza, si no lo crea. Bajo /api/panel.
 */
function ok(data: unknown) {
  return NextResponse.json({ success: true, data });
}
function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code: "VALIDATION", message } }, { status });
}

const money = z.union([z.coerce.number().nonnegative(), z.null()]).optional();
const rowSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().nullable().optional(),
  unit: z.string().trim().min(1).max(20).default("kg"),
  // > 0: un precio en 0 es casi siempre un dato mal cargado, no un precio real.
  retailPriceCop: z.coerce.number().positive(),
  wholesalePriceCop: money,
  wholesaleThreshold: money,
  wholesalePrice2Cop: money,
  wholesaleThreshold2: money,
  minOrder: money,
  active: z.boolean().optional(),
});

// 0 en los campos OPCIONALES (mayoristas/mínimo) se normaliza a null — mismo
// criterio que la edición manual (pricing/route.ts).
const toNum = (v: number | null | undefined) => (v == null || v === 0 ? null : String(v));

export async function POST(req: Request) {
  const parsed = z
    .object({ rows: z.array(rowSchema).min(1).max(1000) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "CSV inválido.");
  const { rows } = parsed.data;

  // Catálogo actual indexado por nombre NORMALIZADO (sin acentos, minúsculas,
  // espacios colapsados — mismo criterio que lookup_price) para decidir crear vs
  // actualizar. Antes solo usaba `.toLowerCase()`: una reimportación con distinta
  // acentuación en el nombre creaba un material duplicado en vez de actualizar.
  const existing = await db.select({ id: materials.id, name: materials.name }).from(materials);
  const byName = new Map(existing.map((m) => [normalize(m.name), m.id]));

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const values = {
      name: r.name,
      category: r.category?.trim() || null,
      unit: r.unit,
      retailPriceCop: String(r.retailPriceCop),
      wholesalePriceCop: toNum(r.wholesalePriceCop),
      wholesaleThreshold: toNum(r.wholesaleThreshold),
      wholesalePrice2Cop: toNum(r.wholesalePrice2Cop),
      wholesaleThreshold2: toNum(r.wholesaleThreshold2),
      minOrder: toNum(r.minOrder),
      active: r.active ?? true,
    };
    const id = byName.get(normalize(r.name));
    if (id) {
      await db.update(materials).set({ ...values, updatedAt: new Date() }).where(eq(materials.id, id));
      updated++;
    } else {
      const [row] = await db.insert(materials).values(values).returning({ id: materials.id });
      byName.set(normalize(r.name), row.id); // evita duplicar si el CSV repite el nombre
      created++;
    }
  }

  return ok({ created, updated, total: rows.length });
}
