"use client";

import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Img {
  id: string;
  name: string;
  description: string;
  tags: string[];
  url: string;
  updatedAt: string | null;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const parseTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);

export function ImagesManager() {
  const [items, setItems] = useState<Img[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/images");
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <AddImage onAdded={load} />

      {loading ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Cargando…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Aún no hay imágenes. Sube la primera arriba.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((img) => (
            <ImageCard
              key={img.id}
              img={img}
              onChange={(u) => setItems((p) => p.map((x) => (x.id === u.id ? u : x)))}
              onDelete={() => setItems((p) => p.filter((x) => x.id !== img.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddImage({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setUrl(null);
    setName("");
    setDescription("");
    setTags("");
    setProgress(null);
  }

  async function onFile(file: File) {
    setBusy(true);
    setErr(null);
    setProgress(0);
    try {
      const blob = await upload(`images/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/panel/images/upload",
        onUploadProgress: (p) => setProgress(p.percentage),
      });
      setUrl(blob.url);
      setName(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function save() {
    if (!url) return;
    if (!name.trim()) return setErr("Ponle un nombre.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, name: name.trim(), description: description.trim(), tags: parseTags(tags) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al guardar");
      reset();
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-foreground">Agregar imagen</div>

      {!url ? (
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
              ? progress !== null
                ? `Subiendo… ${Math.round(progress)}%`
                : "Subiendo…"
              : "Haz clic para subir una imagen (JPG, PNG, WEBP, GIF)"}
          </span>
          <span className="text-xs text-muted-foreground">Hasta 10 MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onFile(file);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-40 w-40 shrink-0 rounded-lg border border-border object-cover" />
          <div className="flex-1 space-y-2">
            <input className={inputCls} placeholder="Nombre (ej. Cobre #1)" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea
              rows={2}
              className={inputCls}
              placeholder="Descripción: qué muestra (el bot la usa para encontrarla)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input className={inputCls} placeholder="Etiquetas separadas por coma (cobre, metal, material)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <div className="flex items-center justify-end gap-2">
              <button onClick={reset} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-60">
                <X className="size-4" /> Descartar
              </button>
              <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}

function ImageCard({
  img,
  onChange,
  onDelete,
}: {
  img: Img;
  onChange: (i: Img) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(img.name);
  const [description, setDescription] = useState(img.description);
  const [tags, setTags] = useState(img.tags.join(", "));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/panel/images", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: img.id, name: name.trim(), description: description.trim(), tags: parseTags(tags) }),
      });
      const json = await res.json();
      if (json.success) {
        onChange({ ...img, name: name.trim(), description: description.trim(), tags: parseTags(tags) });
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`¿Borrar la imagen "${img.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/panel/images?id=${img.id}`, { method: "DELETE" });
    onDelete();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.name} className="h-40 w-full object-cover" />
      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            <textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="etiquetas, separadas, por coma" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setEditing(false)} disabled={busy} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">
                Cancelar
              </button>
              <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Guardar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 truncate font-medium text-foreground" title={img.name}>
                {img.name}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary" aria-label="Editar">
                  <Pencil className="size-4" />
                </button>
                <button onClick={remove} disabled={busy} className="text-muted-foreground hover:text-destructive" aria-label="Borrar">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            {img.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{img.description}</p>}
            {img.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {img.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
