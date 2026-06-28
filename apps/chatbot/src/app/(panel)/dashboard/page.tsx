import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  botConfig,
  conversations,
  knowledgeGaps,
  knowledgeSources,
  leads,
  materials,
} from "@/lib/db/schema";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

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

  // Puesta a punto (onboarding): qué falta para tener el bot listo.
  const [cfg] = await db
    .select({
      welcome: botConfig.welcomeMessage,
      lat: botConfig.locationLat,
      admin: botConfig.adminWhatsapp,
    })
    .from(botConfig)
    .where(eq(botConfig.id, 1));

  const checklist = [
    { label: "Cargar precios", done: activeMaterials > 0, href: "/pricing", hint: "Tus materiales y precios para cotizar" },
    { label: "Subir conocimiento", done: readySources > 0, href: "/knowledge", hint: "Documentos o FAQs que el bot usa" },
    { label: "Mensaje de bienvenida", done: !!cfg?.welcome?.trim(), href: "/settings", hint: "El saludo del bot" },
    { label: "Ubicación de la sede", done: cfg?.lat != null, href: "/settings", hint: "Para la tarjeta de mapa" },
    { label: "WhatsApp del administrador", done: !!cfg?.admin?.trim(), href: "/settings", hint: "Para recibir avisos de leads" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;

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

      {!allDone && (
        <section className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Puesta a punto del bot</h2>
            <span className="text-xs text-muted-foreground">{doneCount} de {checklist.length} listo</span>
          </div>
          <ul className="space-y-1.5">
            {checklist.map((c) => (
              <li key={c.label}>
                {c.done ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                    <span className="line-through">{c.label}</span>
                  </div>
                ) : (
                  <Link href={c.href} className="group flex items-center gap-2 text-sm text-foreground">
                    <Circle className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs text-muted-foreground">· {c.hint}</span>
                    <ArrowRight className="size-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
