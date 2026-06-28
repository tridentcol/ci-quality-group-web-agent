import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { listQuotes } from "@/lib/data/panel";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default async function QuotesPage() {
  const items = await listQuotes();
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Cotizaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cotizaciones generadas desde un lead. Abre el enlace para compartirlo o imprimirlo en PDF.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Aún no hay cotizaciones. Créalas desde un lead (botón <FileText className="inline size-3.5" />).
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border">
            {items.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/cotizacion/${q.id}`}
                  target="_blank"
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">#{q.ref}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{q.customerName ?? "Sin cliente"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.lines} línea{q.lines === 1 ? "" : "s"}
                      {q.createdAt ? ` · ${new Date(q.createdAt).toLocaleDateString("es-CO")}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{cop.format(q.total)}</span>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
