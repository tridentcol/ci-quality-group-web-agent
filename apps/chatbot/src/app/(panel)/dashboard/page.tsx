import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  botConfig,
  conversations,
  knowledgeGaps,
  knowledgeSources,
  leads,
  materials,
  messages,
  systemEvents,
  images,
} from "@/lib/db/schema";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  MessagesSquare,
  Users,
  Hand,
  Activity,
  HelpCircle,
  Tags,
  BookOpen,
  Image as ImageIcon,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Fecha en zona Bogotá → "YYYY-MM-DD" y día del mes, para alinear el eje del gráfico.
function bogota(d: Date): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: "America/Bogota" }));
}
function ymd(b: Date): string {
  return `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(b.getDate()).padStart(2, "0")}`;
}

const FUNNEL = [
  { key: "new", label: "Nuevos", color: "bg-primary/30" },
  { key: "contacted", label: "Contactados", color: "bg-primary/50" },
  { key: "quoted", label: "Cotizados", color: "bg-primary/70" },
  { key: "ready", label: "Por cerrar", color: "bg-warning" },
  { key: "won", label: "Ganados", color: "bg-success" },
  { key: "lost", label: "Perdidos", color: "bg-destructive" },
] as const;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  new: { label: "Nuevo", cls: "bg-primary/10 text-primary" },
  contacted: { label: "Contactado", cls: "bg-primary/10 text-primary" },
  quoted: { label: "Cotizado", cls: "bg-primary/10 text-primary" },
  ready: { label: "Por cerrar", cls: "bg-warning/15 text-warning" },
  won: { label: "Ganado", cls: "bg-success/15 text-success" },
  lost: { label: "Perdido", cls: "bg-destructive/10 text-destructive" },
};

export default async function DashboardPage() {
  const user = await currentUser();
  const name = user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "admin";

  const nowMs = Date.now();
  const since7 = new Date(nowMs - 7 * 86_400_000);
  const since14 = new Date(nowMs - 14 * 86_400_000);
  const since24 = new Date(nowMs - 86_400_000);

  const [
    totalConv,
    conv7,
    handoffs,
    totalLeads,
    leads7,
    openGaps,
    readySources,
    activeMaterials,
    totalMedia,
    errors24,
    msgByDay,
    leadsByStatus,
    recentLeads,
    recentGaps,
    cfgRows,
    wonCount,
    lostCount,
    revenueRows,
    leadsByChannel,
  ] = await Promise.all([
    db.$count(conversations),
    db.$count(conversations, gte(conversations.createdAt, since7)),
    db.$count(conversations, eq(conversations.status, "human_controlled")),
    db.$count(leads, eq(leads.test, false)),
    db.$count(leads, and(eq(leads.test, false), gte(leads.createdAt, since7))),
    db.$count(knowledgeGaps, eq(knowledgeGaps.status, "open")),
    db.$count(knowledgeSources, eq(knowledgeSources.status, "ready")),
    db.$count(materials, eq(materials.active, true)),
    db.$count(images),
    db.$count(systemEvents, and(eq(systemEvents.level, "error"), gte(systemEvents.createdAt, since24))),
    db
      .select({
        d: sql<string>`to_char(date_trunc('day', ${messages.createdAt} AT TIME ZONE 'America/Bogota'),'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(gte(messages.createdAt, since14))
      .groupBy(sql`1`),
    db
      .select({ status: leads.status, n: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.test, false))
      .groupBy(leads.status),
    db
      .select({
        ref: leads.ref,
        name: leads.name,
        contact: leads.contact,
        status: leads.status,
        channel: conversations.channel,
        conversationId: leads.conversationId,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .leftJoin(conversations, eq(leads.conversationId, conversations.id))
      .where(eq(leads.test, false))
      .orderBy(desc(leads.createdAt))
      .limit(6),
    db
      .select({ id: knowledgeGaps.id, question: knowledgeGaps.question, createdAt: knowledgeGaps.createdAt })
      .from(knowledgeGaps)
      .where(eq(knowledgeGaps.status, "open"))
      .orderBy(desc(knowledgeGaps.createdAt))
      .limit(6),
    db
      .select({ welcome: botConfig.welcomeMessage, lat: botConfig.locationLat, admin: botConfig.adminWhatsapp })
      .from(botConfig)
      .where(eq(botConfig.id, 1)),
    db.$count(leads, and(eq(leads.test, false), eq(leads.status, "won"))),
    db.$count(leads, and(eq(leads.test, false), eq(leads.status, "lost"))),
    db
      .select({ total: sql<string>`coalesce(sum(${leads.agreedPriceCop}),0)` })
      .from(leads)
      .where(and(eq(leads.test, false), eq(leads.status, "won"))),
    db
      .select({ channel: conversations.channel, n: sql<number>`count(*)::int` })
      .from(leads)
      .leftJoin(conversations, eq(leads.conversationId, conversations.id))
      .where(eq(leads.test, false))
      .groupBy(conversations.channel),
  ]);

  const cfg = cfgRows[0];

  // Serie de 14 días para el gráfico de actividad (rellena días sin mensajes con 0).
  const dayMap = new Map(msgByDay.map((r) => [r.d, r.n]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const b = bogota(new Date(nowMs - (13 - i) * 86_400_000));
    return { label: String(b.getDate()), value: dayMap.get(ymd(b)) ?? 0 };
  });
  const maxBar = Math.max(1, ...series.map((s) => s.value));
  const msg14 = series.reduce((a, s) => a + s.value, 0);

  // Embudo de leads.
  const statusMap = new Map(leadsByStatus.map((r) => [r.status, r.n]));
  const funnel = FUNNEL.map((s) => ({ ...s, value: statusMap.get(s.key) ?? 0 }));
  const maxFunnel = Math.max(1, ...funnel.map((s) => s.value));
  const won = statusMap.get("won") ?? 0;

  // Métricas de venta.
  const closed = wonCount + lostCount;
  const closeRate = closed > 0 ? Math.round((wonCount / closed) * 100) : null;
  const revenueWon = Number(revenueRows[0]?.total ?? 0);
  const channelLeads = leadsByChannel
    .map((r) => ({ label: r.channel ?? "otro", value: r.n }))
    .sort((a, b) => b.value - a.value);
  const maxChannel = Math.max(1, ...channelLeads.map((c) => c.value));
  const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  const checklist = [
    { label: "Cargar precios", done: activeMaterials > 0, href: "/pricing", hint: "Tus materiales y precios" },
    { label: "Subir conocimiento", done: readySources > 0, href: "/knowledge", hint: "Documentos o FAQs" },
    { label: "Mensaje de bienvenida", done: !!cfg?.welcome?.trim(), href: "/settings", hint: "El saludo del bot" },
    { label: "Ubicación de la sede", done: cfg?.lat != null, href: "/settings", hint: "Para la tarjeta de mapa" },
    { label: "WhatsApp del administrador", done: !!cfg?.admin?.trim(), href: "/settings", hint: "Avisos de leads" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;

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

      {/* KPIs principales con contexto */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={MessagesSquare} label="Conversaciones" value={totalConv} sub={`+${conv7} esta semana`} href="/conversations" />
        <Kpi icon={Users} label="Leads" value={totalLeads} sub={`+${leads7} esta semana`} href="/leads" />
        <Kpi icon={Hand} label="Relevos activos" value={handoffs} sub={handoffs > 0 ? "esperan a un humano" : "todo automático"} href="/conversations" accent={handoffs > 0 ? "warning" : undefined} />
        <Kpi icon={Activity} label="Errores (24 h)" value={errors24} sub={errors24 > 0 ? "revisar Salud" : "sin incidencias"} href="/health" accent={errors24 > 0 ? "destructive" : "success"} />
      </div>

      {/* Gráficos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Actividad 14 días */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="size-4 text-primary" /> Actividad (14 días)
            </h2>
            <span className="text-xs text-muted-foreground">{msg14} mensajes</span>
          </div>
          <div className="flex h-36 items-end gap-1.5">
            {series.map((s, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${Math.max(2, (s.value / maxBar) * 100)}%` }}
                    title={`${s.value} mensajes`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Embudo de leads */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Leads por estado</h2>
            <span className="text-xs text-muted-foreground">{won} ganados</span>
          </div>
          <div className="space-y-2.5">
            {funnel.map((s) => (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium text-foreground">{s.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent">
                  <div className={cn("h-full rounded-full", s.color)} style={{ width: `${(s.value / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Métricas de venta */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Tasa de cierre</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{closeRate != null ? `${closeRate}%` : "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{wonCount} ganados · {lostCount} perdidos</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Ingresos ganados</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{cop.format(revenueWon)}</p>
            <p className="mt-1 text-xs text-muted-foreground">suma de leads ganados (acordado)</p>
          </div>
        </div>
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Leads por canal</h2>
          {channelLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin leads todavía.</p>
          ) : (
            <div className="space-y-2.5">
              {channelLeads.map((c) => (
                <div key={c.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{c.label}</span>
                    <span className="font-medium text-foreground">{c.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(c.value / maxChannel) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Listas: leads recientes + huecos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Leads recientes</h2>
            <Link href="/leads" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Aún no hay leads.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentLeads.map((l) => {
                const b = STATUS_BADGE[l.status] ?? STATUS_BADGE.new;
                const inner = (
                  <div className="flex items-center gap-3 px-5 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">#{l.ref}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{l.name ?? "Sin nombre"}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.contact ?? "sin contacto"}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", b.cls)}>{b.label}</span>
                  </div>
                );
                return (
                  <li key={l.ref}>
                    {l.conversationId ? (
                      <Link href={`/conversations/${l.conversationId}`} className="block transition-colors hover:bg-accent/50">{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <HelpCircle className="size-4 text-warning" /> Huecos de conocimiento
            </h2>
            <Link href="/gaps" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {recentGaps.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sin preguntas pendientes. 🎉</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentGaps.map((g) => (
                <li key={g.id} className="px-5 py-2.5">
                  <p className="text-sm text-foreground">{g.question}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Mini-stats de contenido */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini icon={Tags} label="Materiales" value={activeMaterials} href="/pricing" />
        <Mini icon={BookOpen} label="Fuentes" value={readySources} href="/knowledge" />
        <Mini icon={HelpCircle} label="Huecos" value={openGaps} href="/gaps" />
        <Mini icon={ImageIcon} label="Medios" value={totalMedia} href="/images" />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub: string;
  href: string;
  accent?: "warning" | "destructive" | "success";
}) {
  const accentCls =
    accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : accent === "success" ? "text-success" : "text-primary";
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", accentCls)} />
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}

function Mini({ icon: Icon, label, value, href }: { icon: typeof Users; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary">
      <Icon className="size-5 text-muted-foreground" />
      <div>
        <div className="text-lg font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}
