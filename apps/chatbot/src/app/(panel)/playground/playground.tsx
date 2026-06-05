"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Retrieved {
  content: string;
  similarity: number;
}
interface ToolCall {
  name: string;
  args: unknown;
  result: unknown;
}
interface Result {
  reply: string;
  model: string;
  routerReason: string;
  contextUsed: boolean;
  retrieved: Retrieved[];
  toolCalls: ToolCall[];
  attachments: { url: string; caption: string }[];
}

export function Playground() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/panel/playground", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const json = await r.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al generar");
      setRes(json.data);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error al generar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <textarea
          rows={3}
          placeholder="Ej: ¿A cómo me pagan el cobre si llevo 200 kilos?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(e);
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter para enviar</span>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Probar
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </form>

      {res && (
        <div className="space-y-4">
          {/* Respuesta */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" /> Respuesta del bot
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{res.reply || "(sin texto)"}</p>
            {res.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {res.attachments.map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.url}
                    src={a.url}
                    alt={a.caption}
                    className="h-24 w-24 rounded-md border border-border object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Diagnóstico */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Modelo" value={res.model} />
            <Stat label="Contexto" value={res.contextUsed ? "sí" : "no"} good={res.contextUsed} bad={!res.contextUsed} />
            <Stat label="Chunks" value={String(res.retrieved.length)} />
            <Stat label="Tools" value={String(res.toolCalls.length)} />
          </div>
          <p className="text-xs text-muted-foreground">Router: {res.routerReason}</p>

          {/* Tools llamadas */}
          {res.toolCalls.length > 0 && (
            <Section title="Herramientas usadas">
              {res.toolCalls.map((t, i) => (
                <div key={i} className="rounded-md border border-border bg-background p-3 text-xs">
                  <div className="font-mono font-semibold text-foreground">{t.name}</div>
                  <pre className="mt-1 overflow-x-auto text-muted-foreground">
                    {JSON.stringify(t.args, null, 2)}
                  </pre>
                  <div className="mt-1 text-muted-foreground">
                    → {JSON.stringify(t.result)}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Chunks recuperados */}
          <Section title={`Conocimiento recuperado (${res.retrieved.length})`}>
            {res.retrieved.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No se recuperó ningún fragmento. El bot debería registrar un hueco y derivar.
              </p>
            ) : (
              res.retrieved.map((c, i) => (
                <div key={i} className="rounded-md border border-border bg-background p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Fragmento {i + 1}</span>
                    <ScoreBadge score={c.similarity} />
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-xs text-foreground">{c.content}</p>
                </div>
              ))
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold",
          good && "text-success",
          bad && "text-warning",
          !good && !bad && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = score >= 0.4 ? "bg-success/15 text-success" : score >= 0.3 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {pct}% similitud
    </span>
  );
}
