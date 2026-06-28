import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessagesSquare, Users, Brain } from "lucide-react";
import { ChannelBadge, ConversationStatusBadge } from "@/components/panel/channel-badge";
import { getCustomer } from "@/lib/data/panel";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo", contacted: "Contactado", quoted: "Cotizado", ready: "Por cerrar", won: "Ganado", lost: "Perdido",
};

// Renderiza los "hechos" aprendidos (jsonb) de forma legible, sea array u objeto.
function Facts({ facts }: { facts: unknown }) {
  if (!facts || (Array.isArray(facts) && facts.length === 0)) return null;
  const entries = Array.isArray(facts)
    ? facts.map((f) => String(f))
    : typeof facts === "object"
      ? Object.entries(facts as Record<string, unknown>).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      : [String(facts)];
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{e}</span></li>
      ))}
    </ul>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCustomer(id);
  if (!data) notFound();
  const { profile, conversations, leads } = data;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {(profile.name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{profile.name ?? "Sin nombre"}</h1>
              <ChannelBadge channel={profile.channel} />
            </div>
            <p className="text-sm text-muted-foreground">{[profile.company, profile.contact].filter(Boolean).join(" · ") || "sin contacto"}</p>
          </div>
        </div>
      </div>

      {/* Memoria del bot */}
      {profile.facts != null && (Array.isArray(profile.facts) ? profile.facts.length > 0 : true) && (
        <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Brain className="size-4 text-primary" /> Lo que el bot recuerda</h2>
          <Facts facts={profile.facts} />
        </section>
      )}

      {/* Leads */}
      <section className="mb-6 rounded-xl border border-border bg-card shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold text-foreground"><Users className="size-4 text-primary" /> Leads ({leads.length})</h2>
        {leads.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sin leads.</p>
        ) : (
          <ul className="divide-y divide-border">
            {leads.map((l) => {
              const inner = (
                <div className="flex items-center gap-3 px-5 py-2.5">
                  <span className="font-mono text-xs text-muted-foreground">#{l.ref}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{l.interest ?? l.materialName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{STATUS_LABEL[l.status] ?? l.status}{l.createdAt ? ` · ${new Date(l.createdAt).toLocaleDateString("es-CO")}` : ""}</p>
                  </div>
                  {l.agreedPriceCop && <span className="shrink-0 text-sm font-medium text-foreground">{cop.format(Number(l.agreedPriceCop))}</span>}
                </div>
              );
              return <li key={l.ref}>{l.conversationId ? <Link href={`/conversations/${l.conversationId}`} className="block hover:bg-accent/50">{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </section>

      {/* Conversaciones */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold text-foreground"><MessagesSquare className="size-4 text-primary" /> Conversaciones ({conversations.length})</h2>
        {conversations.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sin conversaciones.</p>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/conversations/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-accent/50">
                  <ChannelBadge channel={c.channel} />
                  <span className="flex-1 text-sm text-foreground">{c.messageCount} mensajes</span>
                  <ConversationStatusBadge status={c.status} />
                  {c.lastMessageAt && <span className="text-xs text-muted-foreground">{new Date(c.lastMessageAt).toLocaleDateString("es-CO")}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
