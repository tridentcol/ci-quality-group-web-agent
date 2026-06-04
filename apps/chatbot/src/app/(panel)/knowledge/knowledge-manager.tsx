"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Link2,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Source {
  id: string;
  type: string;
  name: string;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  createdAt: string | null;
}

type Tab = "file" | "link" | "text";

const STATUS: Record<Source["status"], { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pendiente", cls: "bg-warning/15 text-warning", Icon: Clock },
  processing: { label: "Procesando", cls: "bg-warning/15 text-warning", Icon: Loader2 },
  ready: { label: "Listo", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
  failed: { label: "Falló", cls: "bg-destructive/15 text-destructive", Icon: AlertCircle },
};

export function KnowledgeManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [tab, setTab] = useState<Tab>("file");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/knowledge");
    const json = await res.json();
    if (json.success) setSources(json.data);
  }, []);

  // Carga inicial + polling mientras haya fuentes en proceso
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const active = sources.some((s) => s.status === "pending" || s.status === "processing");
    if (!active) return;
    timer.current = setTimeout(load, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sources, load]);

  async function submit(body: FormData | object, isForm: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/knowledge", {
        method: "POST",
        ...(isForm
          ? { body: body as FormData }
          : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al subir");
      await load();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar esta fuente y sus fragmentos?")) return;
    await fetch(`/api/panel/knowledge?id=${id}`, { method: "DELETE" });
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-8">
      <UploadCard tab={tab} setTab={setTab} busy={busy} err={err} submit={submit} />

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
          Fuentes de conocimiento
        </div>
        {sources.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Aún no hay fuentes. Sube un documento, pega un enlace o texto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-5 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const st = STATUS[s.status] ?? STATUS.pending;
                return (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-xs truncate px-5 py-3 text-foreground" title={s.name}>
                      {s.name}
                    </td>
                    <td className="px-3 py-3 uppercase text-muted-foreground">{s.type}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          st.cls,
                        )}
                        title={s.error ?? undefined}
                      >
                        <st.Icon className={cn("size-3.5", s.status === "processing" && "animate-spin")} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => remove(s.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Borrar fuente"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UploadCard({
  tab,
  setTab,
  busy,
  err,
  submit,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  busy: boolean;
  err: string | null;
  submit: (body: FormData | object, isForm: boolean) => Promise<boolean>;
}) {
  const [link, setLink] = useState("");
  const [text, setText] = useState("");

  const TABS: { id: Tab; label: string; Icon: typeof Upload }[] = [
    { id: "file", label: "Archivo", Icon: Upload },
    { id: "link", label: "Enlace", Icon: Link2 },
    { id: "text", label: "Texto", Icon: FileText },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center transition-colors hover:border-primary",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <Upload className="size-6 text-muted-foreground" />
          <span className="text-sm text-foreground">Haz clic para subir un PDF, DOCX, PPTX o TXT</span>
          <span className="text-xs text-muted-foreground">Se procesa en segundo plano</span>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              await submit(fd, true);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {tab === "link" && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!link.trim()) return;
            const okDone = await submit({ url: link.trim() }, false);
            if (okDone) setLink("");
          }}
        >
          <input
            type="url"
            required
            placeholder="https://ejemplo.com/catalogo"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <SubmitBtn busy={busy}>Agregar</SubmitBtn>
        </form>
      )}

      {tab === "text" && (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const okDone = await submit({ text: text.trim() }, false);
            if (okDone) setText("");
          }}
        >
          <textarea
            required
            rows={5}
            placeholder="Pega aquí texto de conocimiento (precios, condiciones, FAQ)…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end">
            <SubmitBtn busy={busy}>Agregar texto</SubmitBtn>
          </div>
        </form>
      )}

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}

function SubmitBtn({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
