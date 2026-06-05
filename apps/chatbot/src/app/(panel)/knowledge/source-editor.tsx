"use client";

import { useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditorDraft {
  /** 'new' = alta tras previsualizar; 'edit' = reedición de una fuente existente. */
  mode: "new" | "edit";
  sourceId?: string;
  name: string;
  type: string;
  content: string;
  /** Prioridad de la fuente (0–10): ante similitud pareja, gana la mayor. */
  priority?: number;
  /** Solo en alta de archivo: blob a borrar tras guardar (la verdad es el texto). */
  originalUrl?: string | null;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

// Editor del texto plano de una fuente: se usa para revisar/corregir lo extraído
// (alta) y para reeditar una fuente ya guardada. Al guardar crea (POST) o
// re-ingiere (PATCH) y la lista vuelve a poll-ear hasta "Listo".
export function SourceEditor({
  draft,
  onSaved,
  onCancel,
}: {
  draft: EditorDraft;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [content, setContent] = useState(draft.content);
  const [priority, setPriority] = useState(draft.priority ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chars = content.trim().length;

  async function save() {
    if (!name.trim()) return setErr("Ponle un nombre a la fuente.");
    if (!content.trim()) return setErr("El contenido no puede estar vacío.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/knowledge", {
        method: draft.mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          draft.mode === "edit"
            ? { id: draft.sourceId, name: name.trim(), content, priority }
            : { name: name.trim(), type: draft.type, content, priority, originalUrl: draft.originalUrl ?? null },
        ),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al guardar");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {draft.mode === "edit" ? "Editar fuente" : "Revisar texto extraído"}
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {draft.type}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block sm:w-40">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Prioridad (0–10)</span>
          <input
            type="number"
            min={0}
            max={10}
            className={inputCls}
            value={priority}
            onChange={(e) => setPriority(Math.max(0, Math.min(10, Number(e.target.value))))}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Prioridad alta = el bot prefiere esta fuente ante info parecida (útil para lo más actualizado).
      </p>

      <label className="mt-3 block">
        <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Texto plano (corrige lo que haga falta antes de guardar)</span>
          <span>{chars.toLocaleString("es-CO")} caracteres</span>
        </span>
        <textarea
          rows={16}
          className={cn(inputCls, "font-mono text-xs leading-relaxed")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Se guarda solo este texto (el archivo original no se conserva). Al guardar se
        {draft.mode === "edit" ? " re-procesa" : " procesa"} para que el bot lo use.
      </p>

      <div className="mt-3 flex items-center justify-end gap-2">
        {err && <p className="mr-auto text-sm text-destructive">{err}</p>}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <X className="size-4" /> Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {draft.mode === "edit" ? "Guardar y re-procesar" : "Guardar fuente"}
        </button>
      </div>
    </div>
  );
}
