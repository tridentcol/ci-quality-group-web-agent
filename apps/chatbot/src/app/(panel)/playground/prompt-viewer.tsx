"use client";

import { useState } from "react";
import { Loader2, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

export function PromptViewer() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{
    system: string;
    model: string;
    routerReason: string;
    contextUsed: boolean;
    retrievedCount: number;
  } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/panel/inspect/prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
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
        Mira el system prompt EXACTO que el bot arma para un mensaje: identidad, tono, reglas,
        contexto recuperado y bienvenida/horario. Transparencia total de por qué responde así.
      </p>

      <form onSubmit={run} className="flex gap-2">
        <input
          placeholder="Ej: ¿a cómo compran el cobre?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileCode className="size-4" />}
          Ver prompt
        </button>
      </form>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">Modelo:</span> {data.model}
            </span>
            <span>
              <span className="font-medium text-foreground">Contexto:</span>{" "}
              <span className={data.contextUsed ? "text-success" : "text-warning"}>
                {data.contextUsed ? `sí (${data.retrievedCount} frag.)` : "no"}
              </span>
            </span>
            <span>
              <span className="font-medium text-foreground">Router:</span> {data.routerReason}
            </span>
          </div>
          <pre
            className={cn(
              "max-h-[55vh] overflow-auto rounded-lg border border-border bg-card p-4",
              "whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground",
            )}
          >
            {data.system}
          </pre>
        </div>
      )}
    </div>
  );
}
