"use client";

import { useCallback, useState } from "react";
import { Loader2, RotateCw, Trash2, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/panel/confirm-dialog";

interface Event {
  id: string;
  level: "error" | "warning" | "info";
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string | null;
}
interface Summary {
  error: number;
  warning: number;
  info: number;
}

const LEVEL = {
  error: { icon: AlertCircle, cls: "text-destructive", bg: "bg-destructive/10", label: "Error" },
  warning: { icon: AlertTriangle, cls: "text-warning", bg: "bg-warning/10", label: "Aviso" },
  info: { icon: Info, cls: "text-muted-foreground", bg: "bg-accent", label: "Info" },
} as const;

export function HealthManager({ initial }: { initial: { events: Event[]; summary: Record<string, number> } }) {
  const [events, setEvents] = useState<Event[] | null>(initial.events);
  const [summary, setSummary] = useState<Summary>({ error: 0, warning: 0, info: 0, ...initial.summary });
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  // Datos iniciales del servidor; `load` refresca con el botón Actualizar y tras Limpiar.
  const load = useCallback(async () => {
    const res = await fetch("/api/panel/health");
    const json = await res.json();
    if (json.success) {
      setEvents(json.data.events);
      setSummary({ error: 0, warning: 0, info: 0, ...json.data.summary });
    }
  }, []);

  async function clearAll() {
    if (!(await confirm({ title: "¿Limpiar la bitácora?", description: "Se borran todos los eventos registrados.", confirmLabel: "Limpiar", destructive: true }))) return;
    setBusy(true);
    try {
      await fetch("/api/panel/health", { method: "DELETE" });
      await load();
      toast.success("Bitácora limpiada.");
    } finally {
      setBusy(false);
    }
  }

  if (events === null) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const healthy = summary.error === 0 && summary.warning === 0;

  return (
    <div className="space-y-5">
      {/* Resumen 24h */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard level="error" n={summary.error} />
        <SummaryCard level="warning" n={summary.warning} />
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
          <CheckCircle2 className={cn("size-5", healthy ? "text-success" : "text-muted-foreground")} />
          <span className="text-sm text-foreground">
            {healthy ? "Todo en orden (24 h)" : "Hay incidencias (24 h)"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Últimos eventos</span>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent">
            <RotateCw className="size-3.5" /> Actualizar
          </button>
          {events.length > 0 && (
            <button onClick={clearAll} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60">
              <Trash2 className="size-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Sin eventos registrados. 🎉 El bot no ha reportado errores.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const L = LEVEL[e.level] ?? LEVEL.info;
            const Icon = L.icon;
            return (
              <li key={e.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", L.bg)}>
                    <Icon className={cn("size-3.5", L.cls)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("font-medium", L.cls)}>{L.label}</span>
                      <span className="rounded bg-accent px-1.5 py-0.5">{e.source}</span>
                      <span>{e.createdAt ? new Date(e.createdAt).toLocaleString("es-CO") : ""}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-foreground">{e.message}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({ level, n }: { level: "error" | "warning"; n: number }) {
  const L = LEVEL[level];
  const Icon = L.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className={cn("flex size-9 items-center justify-center rounded-full", L.bg)}>
        <Icon className={cn("size-5", L.cls)} />
      </span>
      <div>
        <div className="text-lg font-semibold text-foreground">{n}</div>
        <div className="text-xs text-muted-foreground">{L.label}s (24 h)</div>
      </div>
    </div>
  );
}
