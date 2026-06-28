"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChannelBadge } from "@/components/panel/channel-badge";
import type { Lead, Status } from "./leads-manager";

// Columnas del pipeline, en orden de avance comercial.
const COLUMNS: { status: Status; label: string; accent: string }[] = [
  { status: "new", label: "Nuevos", accent: "bg-slate-400" },
  { status: "contacted", label: "Contactados", accent: "bg-blue-400" },
  { status: "quoted", label: "Cotizados", accent: "bg-violet-400" },
  { status: "ready", label: "Por cerrar", accent: "bg-amber-400" },
  { status: "won", label: "Ganados", accent: "bg-emerald-500" },
  { status: "lost", label: "Perdidos", accent: "bg-rose-400" },
];

// Etapas activas: aquí un lead "envejece" si lleva días sin avanzar.
const ACTIVE: Status[] = ["new", "contacted", "quoted", "ready"];
const STALE_DAYS = 3;

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

export function KanbanBoard({
  items,
  onChange,
}: {
  items: Lead[];
  onChange: (l: Lead) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<Status, Lead[]>();
    for (const c of COLUMNS) map.set(c.status, []);
    for (const l of items) map.get(l.status)?.push(l);
    return map;
  }, [items]);

  async function move(lead: Lead, status: Status) {
    if (lead.status === status) return;
    const prev = lead.status;
    onChange({ ...lead, status }); // optimista
    try {
      const res = await fetch("/api/panel/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id, status }),
      });
      const json = await res.json();
      if (json.success) {
        onChange(json.data);
      } else {
        onChange({ ...lead, status: prev });
        toast.error(json.error?.message ?? "No se pudo mover.");
      }
    } catch {
      onChange({ ...lead, status: prev });
      toast.error("No se pudo mover.");
    }
  }

  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-3">
      {COLUMNS.map((col) => {
        const leads = byStatus.get(col.status) ?? [];
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.status);
            }}
            onDragLeave={() => setOver((s) => (s === col.status ? null : s))}
            onDrop={() => {
              const lead = items.find((l) => l.id === dragId);
              if (lead) move(lead, col.status);
              setDragId(null);
              setOver(null);
            }}
            className={cn(
              "flex w-64 shrink-0 snap-start flex-col rounded-xl border bg-muted/30 transition-colors sm:w-[17rem]",
              over === col.status ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span className={cn("size-2 rounded-full", col.accent)} />
              <span className="text-sm font-semibold text-foreground">{col.label}</span>
              <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                {leads.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {leads.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Vacío
                </p>
              ) : (
                leads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    dragging={dragId === lead.id}
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  lead,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const age = daysSince(lead.createdAt);
  const stale = ACTIVE.includes(lead.status) && age != null && age >= STALE_DAYS;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition active:cursor-grabbing",
        dragging && "opacity-40",
        lead.test && "bg-warning/5",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{lead.ref}</span>
        <span className="truncate text-sm font-medium text-foreground">{lead.name ?? "—"}</span>
        <ChannelBadge channel={lead.channel} />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {lead.interest ?? lead.materialName ?? "sin interés"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {lead.agreedPriceCop && (
          <span className="text-sm font-semibold text-foreground">
            {cop.format(Number(lead.agreedPriceCop))}
          </span>
        )}
        {stale && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning"
            title={`Sin avanzar hace ${age} días`}
          >
            <Clock className="size-3" /> {age}d
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href={`/leads#${lead.ref}`}
            className="text-muted-foreground transition-colors hover:text-primary"
            aria-label="Cotizar / ver"
            title="Ver en la lista"
          >
            <FileText className="size-3.5" />
          </Link>
          {lead.conversationId && (
            <Link
              href={`/conversations/${lead.conversationId}`}
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label="Abrir conversación"
              title="Abrir conversación"
            >
              <MessageSquare className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
