import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";

/** Cotizaciones: crear (desde un lead o a mano) y listar. Bajo /api/panel → Clerk. */
function ok(data: unknown) {
  return NextResponse.json({ success: true, data });
}
function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code: "VALIDATION", message } }, { status });
}

const itemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.union([z.coerce.number().nonnegative(), z.null()]).optional(),
  unit: z.string().trim().max(20).optional(),
  unitPriceCop: z.coerce.number().nonnegative(),
});

const createSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().nullable().optional(),
  customerContact: z.string().trim().nullable().optional(),
  items: z.array(itemSchema).min(1, "Agrega al menos una línea."),
  notes: z.string().trim().nullable().optional(),
  validDays: z.coerce.number().int().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;
  const [row] = await db
    .insert(quotes)
    .values({
      leadId: d.leadId ?? null,
      customerName: d.customerName?.trim() || null,
      customerContact: d.customerContact?.trim() || null,
      items: d.items.map((i) => ({ ...i, unit: i.unit?.trim() || null, quantity: i.quantity ?? null })),
      notes: d.notes?.trim() || null,
      validDays: d.validDays ?? 8,
    })
    .returning({ id: quotes.id, ref: quotes.ref });
  return ok({ id: row.id, ref: row.ref });
}

export async function GET() {
  const rows = await db
    .select({
      id: quotes.id,
      ref: quotes.ref,
      customerName: quotes.customerName,
      customerContact: quotes.customerContact,
      items: quotes.items,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .orderBy(desc(quotes.createdAt));
  return ok(
    rows.map((r) => ({ ...r, createdAt: r.createdAt ? r.createdAt.toISOString() : null })),
  );
}
