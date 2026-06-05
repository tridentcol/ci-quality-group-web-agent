import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  conversations,
  knowledgeGaps,
  knowledgeSources,
  leads,
  materials,
} from "@/lib/db/schema";

// Cuenta filas de una tabla con un filtro opcional.
async function countRows(table: Parameters<typeof db.$count>[0], where?: SQL): Promise<number> {
  return db.$count(table, where);
}

export default async function DashboardPage() {
  const user = await currentUser();
  const name = user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "admin";

  const [totalConv, handoffs, newLeads, openGaps, readySources, activeMaterials] =
    await Promise.all([
      countRows(conversations),
      countRows(conversations, eq(conversations.status, "human_controlled")),
      countRows(leads, eq(leads.status, "new")),
      countRows(knowledgeGaps, eq(knowledgeGaps.status, "open")),
      countRows(knowledgeSources, eq(knowledgeSources.status, "ready")),
      countRows(materials, eq(materials.active, true)),
    ]);

  const KPIS = [
    { label: "Conversaciones", value: totalConv, hint: "en los 3 canales", href: "/conversations" },
    { label: "Relevos activos", value: handoffs, hint: "esperando a un humano", href: "/conversations" },
    { label: "Leads nuevos", value: newLeads, hint: "pendientes de contacto", href: "/leads" },
    { label: "Huecos abiertos", value: openGaps, hint: "por resolver", href: "/gaps" },
    { label: "Fuentes listas", value: readySources, hint: "en el conocimiento", href: "/knowledge" },
    { label: "Materiales activos", value: activeMaterials, hint: "cotizables por el bot", href: "/pricing" },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hola, {name}. Resumen de la operación.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary"
          >
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
