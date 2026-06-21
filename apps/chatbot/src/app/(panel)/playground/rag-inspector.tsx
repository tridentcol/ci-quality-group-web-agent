"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface RagResult {
  content: string;
  similarity: number;
  kind: "qa" | "chunk";
  used: boolean;
}

export function RagInspector() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{ threshold: number; results: RagResult[] } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/panel/inspect/rag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = await r.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error");
      setData(json.data);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Mira qué fragmentos del conocimiento recupera una consulta y con qué similitud, sin chatear.
        Útil para ver si una pregunta tiene cobertura.
      </p>

      <form onSubmit={run} className="flex gap-2">
        <input
          placeholder="Ej: ¿qué garantía tiene la lámina kingspan?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Inspeccionar
        </button>
      </form>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {data && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Umbral del bot: <span className="font-medium text-foreground">{Math.round(data.threshold * 100)}%</span>.
            Los que lo superan ({data.results.filter((r) => r.used).length}) son los que usaría el bot; el resto se descarta.
          </p>
          {data.results.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No se recuperó nada. El bot registraría un hueco y derivaría.
            </p>
          ) : (
            data.results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border bg-card p-3",
                  r.used ? "border-success/40" : "border-border opacity-70",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.kind === "qa" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.kind === "qa" ? "Q&A" : "fragmento"}
                    </span>
                    {r.used ? (
                      <span className="text-xs font-medium text-success">usado</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">descartado</span>
                    )}
                  </div>
                  <ScoreBadge score={r.similarity} />
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-foreground">{r.content}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls =
    score >= 0.4
      ? "bg-success/15 text-success"
      : score >= 0.3
        ? "bg-warning/15 text-warning"
        : "bg-destructive/15 text-destructive";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{pct}%</span>;
}
