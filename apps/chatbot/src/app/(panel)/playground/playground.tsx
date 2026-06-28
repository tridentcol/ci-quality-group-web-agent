"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, RotateCcw, Info, Sparkles } from "lucide-react";
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
interface Diag {
  model: string;
  routerReason: string;
  contextUsed: boolean;
  retrieved: Retrieved[];
  toolCalls: ToolCall[];
  attachments: { url: string; caption: string; type: "image" | "video" }[];
}
interface Turn {
  role: "user" | "assistant";
  content: string;
  diag?: Diag;
}

export function Playground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/panel/playground", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const json = await r.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al generar");
      const d = json.data as Diag & { reply: string };
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: d.reply || "(sin texto)",
          diag: {
            model: d.model,
            routerReason: d.routerReason,
            contextUsed: d.contextUsed,
            retrieved: d.retrieved,
            toolCalls: d.toolCalls,
            attachments: d.attachments,
          },
        },
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Conversación de prueba con memoria entre turnos. No crea leads ni huecos.
        </p>
        {turns.length > 0 && (
          <button
            onClick={() => {
              setTurns([]);
              setErr(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            <RotateCcw className="size-3.5" /> Reiniciar
          </button>
        )}
      </div>

      {/* Transcripción */}
      <div className="min-h-[40vh] space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {turns.length === 0 && !busy && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Escribe como si fueras un cliente. Ej: “Hola, ¿a cómo compran el cobre?”
          </p>
        )}
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> pensando…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Entrada */}
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          placeholder="Tu mensaje… (Enter envía, Shift+Enter salta línea)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar
        </button>
      </div>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const [showDiag, setShowDiag] = useState(false);
  const fromUser = turn.role === "user";

  return (
    <div className={cn("flex flex-col", fromUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm sm:max-w-[75%]",
          fromUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{turn.content}</div>
        {turn.diag?.attachments && turn.diag.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {turn.diag.attachments.map((a) =>
              a.type === "video" ? (
                <video
                  key={a.url}
                  src={a.url}
                  controls
                  className="h-24 w-32 rounded-md border border-border object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.url}
                  src={a.url}
                  alt={a.caption}
                  className="h-20 w-20 rounded-md border border-border object-cover"
                />
              ),
            )}
          </div>
        )}
      </div>

      {turn.diag && (
        <button
          onClick={() => setShowDiag((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="size-3" /> {showDiag ? "ocultar" : "por qué respondió esto"}
        </button>
      )}
      {turn.diag && showDiag && <Diagnostics diag={turn.diag} />}
    </div>
  );
}

function Diagnostics({ diag }: { diag: Diag }) {
  return (
    <div className="mt-1 w-full max-w-[85%] space-y-2 rounded-lg border border-border bg-background p-3 text-xs sm:max-w-[75%]">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Modelo:</span> {diag.model}
        </span>
        <span>
          <span className="font-medium text-foreground">Contexto:</span>{" "}
          <span className={diag.contextUsed ? "text-success" : "text-warning"}>
            {diag.contextUsed ? "sí" : "no"}
          </span>
        </span>
        {diag.toolCalls.length > 0 && (
          <span>
            <span className="font-medium text-foreground">Tools:</span>{" "}
            {diag.toolCalls.map((t) => t.name).join(", ")}
          </span>
        )}
      </div>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Router:</span> {diag.routerReason}
      </p>

      {diag.toolCalls.length > 0 && (
        <div className="space-y-1">
          {diag.toolCalls.map((t, i) => (
            <div key={i} className="rounded border border-border bg-card p-2">
              <span className="font-mono font-semibold text-foreground">{t.name}</span>
              <span className="text-muted-foreground"> → {JSON.stringify(t.result)}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 font-medium text-foreground">
          Conocimiento recuperado ({diag.retrieved.length})
        </p>
        {diag.retrieved.length === 0 ? (
          <p className="text-muted-foreground">
            Nada recuperado: el bot debería registrar un hueco y derivar.
          </p>
        ) : (
          <div className="space-y-1">
            {diag.retrieved.map((c, i) => (
              <div key={i} className="rounded border border-border bg-card p-2">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <ScoreBadge score={c.similarity} />
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-foreground">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
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
  return <span className={cn("rounded-full px-2 py-0.5 font-medium", cls)}>{pct}%</span>;
}
