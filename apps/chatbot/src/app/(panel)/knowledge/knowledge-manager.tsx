"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  Upload,
  Link2,
  FileText,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { SourceEditor, type EditorDraft } from "./source-editor";
import { SourceQaList } from "./source-qa-list";
import { AllQuestions } from "./all-questions";
import { safeBlobName } from "@/lib/blob-name";

interface Source {
  id: string;
  type: string;
  name: string;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  chunkCount: number;
  qaCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

type Tab = "file" | "link" | "text";

const STATUS: Record<Source["status"], { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pendiente", cls: "bg-warning/15 text-warning", Icon: Clock },
  processing: { label: "Procesando", cls: "bg-warning/15 text-warning", Icon: Loader2 },
  ready: { label: "Listo", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
  failed: { label: "Falló", cls: "bg-destructive/15 text-destructive", Icon: AlertCircle },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function KnowledgeManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"fuentes" | "preguntas">("fuentes");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useConfirm();

  const toggleQa = (id: string) => setExpanded((cur) => (cur === id ? null : id));

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/knowledge");
    const json = await res.json();
    if (json.success) setSources(json.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Polling mientras haya fuentes en proceso (alta o re-ingesta).
  useEffect(() => {
    const active = sources.some((s) => s.status === "pending" || s.status === "processing");
    if (!active) return;
    timer.current = setTimeout(load, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sources, load]);

  async function editExisting(id: string) {
    const res = await fetch(`/api/panel/knowledge?id=${id}`);
    const json = await res.json();
    if (!json.success) return;
    const s = json.data as {
      id: string;
      name: string;
      type: string;
      content: string | null;
      priority: number;
    };
    setEditor({
      mode: "edit",
      sourceId: s.id,
      name: s.name,
      type: s.type,
      content: s.content ?? "",
      priority: s.priority,
    });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "¿Borrar esta fuente?", description: "Se eliminan también sus fragmentos y preguntas. No se puede deshacer.", confirmLabel: "Borrar", destructive: true }))) return;
    await fetch(`/api/panel/knowledge?id=${id}`, { method: "DELETE" });
    setSources((prev) => prev.filter((s) => s.id !== id));
    toast.success("Fuente borrada.");
  }

  return (
    <div className="space-y-8">
      {/* Toggle de vistas: por fuente vs todas las preguntas */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 text-sm shadow-sm sm:w-fit">
        {(["fuentes", "preguntas"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-md px-4 py-1.5 font-medium transition-colors sm:flex-none",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {v === "fuentes" ? "Fuentes" : "Todas las preguntas"}
          </button>
        ))}
      </div>

      {view === "preguntas" ? (
        <AllQuestions onChanged={load} />
      ) : (
        <>
      {editor ? (
        <SourceEditor
          draft={editor}
          onSaved={() => {
            setEditor(null);
            load();
          }}
          onCancel={() => setEditor(null)}
        />
      ) : (
        <UploadCard onParsed={setEditor} />
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
          Fuentes de conocimiento
        </div>
        {sources.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Aún no hay fuentes. Sube un documento, pega un enlace o texto.
          </p>
        ) : (
          <>
            {/* Cards en móvil */}
            <ul className="divide-y divide-border/60 md:hidden">
              {sources.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground" title={s.name}>
                        {s.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <SourceStatus status={s.status} error={s.error} />
                        <span className="text-xs uppercase text-muted-foreground">{s.type}</span>
                        <span className="text-xs text-muted-foreground">· {s.chunkCount} frag.</span>
                        <QaToggle count={s.qaCount} open={expanded === s.id} onClick={() => toggleQa(s.id)} />
                      </div>
                    </div>
                    <RowActions onEdit={() => editExisting(s.id)} onDelete={() => remove(s.id)} />
                  </div>
                  {expanded === s.id && s.qaCount > 0 && (
                    <div className="mt-2 rounded-lg border border-border bg-background/50">
                      <SourceQaList sourceId={s.id} onChanged={load} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Tabla en escritorio */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Fragmentos</th>
                    <th className="px-3 py-2 font-medium">Preguntas</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Actualizada</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr className="border-b border-border/60 last:border-0">
                        <td className="max-w-xs truncate px-5 py-3 text-foreground" title={s.name}>
                          {s.name}
                        </td>
                        <td className="px-3 py-3 uppercase text-muted-foreground">{s.type}</td>
                        <td className="px-3 py-3 text-muted-foreground">{s.chunkCount}</td>
                        <td className="px-3 py-3">
                          <QaToggle count={s.qaCount} open={expanded === s.id} onClick={() => toggleQa(s.id)} />
                        </td>
                        <td className="px-3 py-3">
                          <SourceStatus status={s.status} error={s.error} />
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{fmtDate(s.updatedAt)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end">
                            <RowActions onEdit={() => editExisting(s.id)} onDelete={() => remove(s.id)} />
                          </div>
                        </td>
                      </tr>
                      {expanded === s.id && s.qaCount > 0 && (
                        <tr className="border-b border-border/60">
                          <td colSpan={7} className="bg-background/50 p-0">
                            <SourceQaList sourceId={s.id} onChanged={load} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
}

// Chip que muestra cuántas preguntas aporta la fuente y expande la lista.
function QaToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        open ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      {count} {count === 1 ? "pregunta" : "preguntas"}
    </button>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        onClick={onEdit}
        className="text-muted-foreground transition-colors hover:text-primary"
        aria-label="Editar fuente"
      >
        <Pencil className="size-4" />
      </button>
      <button
        onClick={onDelete}
        className="-m-1.5 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
        aria-label="Borrar fuente"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function SourceStatus({ status, error }: { status: Source["status"]; error: string | null }) {
  const st = STATUS[status] ?? STATUS.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        st.cls,
      )}
      title={error ?? undefined}
    >
      <st.Icon className={cn("size-3.5", status === "processing" && "animate-spin")} />
      {st.label}
    </span>
  );
}

// Subida/captura. En vez de crear la fuente directo, EXTRAE el texto (/parse) y
// abre el editor para revisarlo; el guardado real lo hace <SourceEditor>.
function UploadCard({ onParsed }: { onParsed: (d: EditorDraft) => void }) {
  const [tab, setTab] = useState<Tab>("file");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");

  const TABS: { id: Tab; label: string; Icon: typeof Upload }[] = [
    { id: "file", label: "Archivo", Icon: Upload },
    { id: "link", label: "Enlace", Icon: Link2 },
    { id: "text", label: "Texto", Icon: FileText },
  ];

  async function parsePayload(payload: object) {
    const res = await fetch("/api/panel/knowledge/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? "No se pudo extraer el texto");
    const d = json.data as { type: string; name: string; content: string; originalUrl: string | null };
    onParsed({ mode: "new", type: d.type, name: d.name, content: d.content, originalUrl: d.originalUrl });
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setErr(null);
    setProgress(0);
    try {
      // Ruta saneada (sin espacios/acentos/paréntesis) para evitar el 400 del Blob API
      // por desajuste de pathname con el token firmado. Sin multipart de cliente.
      const blob = await upload(`knowledge/${safeBlobName(file.name)}`, file, {
        access: "private",
        handleUploadUrl: "/api/panel/knowledge/upload",
        onUploadProgress: (p) => setProgress(p.percentage),
      });
      await parsePayload({ blobUrl: blob.url, name: file.name });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir el archivo");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function submit(payload: object, reset: () => void) {
    setBusy(true);
    setErr(null);
    try {
      await parsePayload(payload);
      reset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al procesar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <>
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center transition-colors hover:border-primary",
              busy && "pointer-events-none opacity-60",
            )}
          >
            {busy ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <Upload className="size-6 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground">
              {busy
                ? progress !== null && progress < 100
                  ? `Subiendo… ${Math.round(progress)}%`
                  : "Extrayendo texto…"
                : "Haz clic para subir un PDF, DOCX, PPTX o TXT"}
            </span>
            <span className="text-xs text-muted-foreground">
              Hasta 50 MB · podrás revisar el texto antes de guardar
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await uploadFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {busy && progress !== null && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${Math.max(progress, 4)}%` }}
              />
            </div>
          )}
        </>
      )}

      {tab === "link" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) submit({ url: link.trim() }, () => setLink(""));
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
          <SubmitBtn busy={busy}>Extraer</SubmitBtn>
        </form>
      )}

      {tab === "text" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim())
              submit({ text: text.trim(), name: "Texto pegado" }, () => setText(""));
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
            <SubmitBtn busy={busy}>Revisar y guardar</SubmitBtn>
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
