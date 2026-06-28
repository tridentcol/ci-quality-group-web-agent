import Link from "next/link";
import { ChannelBadge } from "@/components/panel/channel-badge";
import { listCustomers } from "@/lib/data/panel";

export default async function CustomersPage() {
  const items = await listCustomers();
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personas que han hablado con el bot. Entra a una para ver su historial, leads y lo que el bot recuerda de ella.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Aún no hay clientes. Aparecen cuando alguien conversa con el bot.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name ?? "Sin nombre"}</span>
                      <ChannelBadge channel={c.channel} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.company, c.contact].filter(Boolean).join(" · ") || "sin contacto"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>{c.conversations} conv · {c.leads} lead{c.leads === 1 ? "" : "s"}</div>
                    {c.lastSeenAt && <div>visto {new Date(c.lastSeenAt).toLocaleDateString("es-CO")}</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
