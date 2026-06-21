"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface Gap {
  id: string;
  question: string;
  status: "open" | "resolved";
  resolvedAnswer: string | null;
  createdAt: string | null;
}

export function GapsManager() {
  const [items, setItems] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/panel/gaps?status=${showResolved ? "all" : "open"}`);
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  const open = items.filter((g) => g.status === "open");
  const resolved = items.filter((g) => g.status === "resolved");

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        Mostrar también los resueltos
      </label>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : open.length === 0 && resolved.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          No hay huecos {showResolved ? "" : "abiertos"}. 🎉
        </p>
      ) : (
        <>
          {open.map((g) => (
            <GapCard key={g.id} gap={g} onResolved={(u) => setItems((p) => p.map((x) => (x.id === u.id ? u : x)))} />
          ))}
          {showResolved &&
            resolved.map((g) => (
              <div key={g.id} className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <div>
                    <p className="font-medium text-foreground">{g.question}</p>
                    <p className="mt-1 text-muted-foreground">{g.resolvedAnswer}</p>
                  </div>
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}

function GapCard({ gap, onResolved }: { gap: Gap; onResolved: (g: Gap) => void }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resolve() {
    if (!answer.trim()) {
      setErr("Escribe la respuesta.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/gaps", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: gap.id, answer: answer.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al resolver");
      onResolved(json.data.gap);
      toast.success("Resuelto. El bot ya puede responder esta pregunta.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error al resolver";
      setErr(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="font-medium text-foreground">{gap.question}</p>
      </div>
      <textarea
        rows={3}
        placeholder="Respuesta para enseñar al bot (se guarda como FAQ y se embebe)…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex items-center justify-between">
        {err ? <p className="text-sm text-destructive">{err}</p> : <span />}
        <button
          onClick={resolve}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Resolver y enseñar
        </button>
      </div>
    </div>
  );
}
