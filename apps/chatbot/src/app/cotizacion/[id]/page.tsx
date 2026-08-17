import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { botConfig, quotes } from "@/lib/db/schema";
import { PrintButton } from "./print-button";

/**
 * Cotización pública e imprimible (se comparte por enlace). Fuera de (panel) → sin
 * Clerk; el id (UUID) es el token. Server component que lee la cotización + datos de
 * la empresa de bot_config.
 *
 * El UUID no es adivinable (defensa principal), pero si el link se filtra a un
 * contexto rastreable (bot de previsualización, foro, etc.) no debería quedar
 * indexado con nombre/teléfono/precios del cliente.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Item {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCop: number;
}

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fdate = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [q] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!q) notFound();
  const [cfg] = await db
    .select({ address: botConfig.locationAddress, name: botConfig.locationName })
    .from(botConfig)
    .where(eq(botConfig.id, 1));

  const items = (q.items ?? []) as Item[];
  const lineTotal = (it: Item) => (it.quantity != null ? it.quantity * it.unitPriceCop : it.unitPriceCop);
  const total = items.reduce((a, it) => a + lineTotal(it), 0);
  const created = q.createdAt ? new Date(q.createdAt) : new Date(0);
  const validUntil = new Date(created.getTime() + q.validDays * 86_400_000);

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground print:bg-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end">
          <PrintButton />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm print:border-0 print:shadow-none sm:p-8">
          {/* Encabezado */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">CI</span>
              <div>
                <p className="text-base font-semibold text-foreground">CI Quality Group S.A.S</p>
                <p className="text-xs text-muted-foreground">
                  {cfg?.name ? `${cfg.name} · ` : ""}
                  {cfg?.address ?? "Disposición de desechos · Chatarrización · Compra/venta de chatarra"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">Cotización #{q.ref}</p>
              <p className="text-xs text-muted-foreground">Fecha: {fdate(created)}</p>
              <p className="text-xs text-muted-foreground">Válida hasta: {fdate(validUntil)}</p>
            </div>
          </div>

          {/* Cliente */}
          {(q.customerName || q.customerContact) && (
            <div className="border-b border-border py-4 text-sm">
              <p className="text-xs uppercase text-muted-foreground">Cliente</p>
              <p className="font-medium text-foreground">{q.customerName ?? "—"}</p>
              {q.customerContact && <p className="text-muted-foreground">{q.customerContact}</p>}
            </div>
          )}

          {/* Líneas */}
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 font-medium">Descripción</th>
                <th className="py-2 text-right font-medium">Cant.</th>
                <th className="py-2 text-right font-medium">Precio</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2 text-foreground">{it.description}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {it.quantity != null ? `${it.quantity}${it.unit ? " " + it.unit : ""}` : "—"}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{cop.format(it.unitPriceCop)}</td>
                  <td className="py-2 text-right font-medium text-foreground">{cop.format(lineTotal(it))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{cop.format(total)}</span>
              </div>
            </div>
          </div>

          {q.notes && (
            <div className="mt-5 rounded-lg bg-accent/50 p-3 text-sm text-muted-foreground">
              <p className="mb-0.5 text-xs font-medium uppercase text-foreground">Notas</p>
              {q.notes}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Precios en pesos colombianos (COP). El pago y la coordinación de entrega los confirma un asesor.
          </p>
        </div>
      </div>
    </div>
  );
}
