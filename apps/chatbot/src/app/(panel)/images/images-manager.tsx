"use client";

import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { invalidateMediaCache } from "@/components/panel/media-picker";
import { safeBlobName } from "@/lib/blob-name";

interface Img {
  id: string;
  type: "image" | "video";
  name: string;
  description: string;
  tags: string[];
  url: string;
  materialUses: number;
  qaUses: number;
  updatedAt: string | null;
}

// "Usado en N materiales · M preguntas" (o "Sin vincular").
function usageLabel(img: { materialUses: number; qaUses: number }): string {
  const parts: string[] = [];
  if (img.materialUses > 0) parts.push(`${img.materialUses} material${img.materialUses === 1 ? "" : "es"}`);
  if (img.qaUses > 0) parts.push(`${img.qaUses} pregunta${img.qaUses === 1 ? "" : "s"}`);
  return parts.length ? `Usado en ${parts.join(" · ")}` : "Sin vincular";
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const parseTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);

export function ImagesManager() {
  const [items, setItems] = useState<Img[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    invalidateMediaCache(); // el banco cambió → refresca el selector de medios
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
          Aún no hay medios. Sube la primera imagen o video arriba.
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
  // Vista previa LOCAL (object URL del archivo): el blob es privado y no se puede
  // mostrar por su URL en el navegador; mostramos el archivo recién elegido.
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setUrl(null);
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    setMediaType("image");
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
      // Subida PRIVADA (el store es privado): igual que el conocimiento, funciona sin
      // CORS. El medio se expone a Meta vía el proxy /api/media/<id>. PUT simple (no
      // multipart) y ruta saneada (sin espacios/acentos/paréntesis). El progreso nunca
      // retrocede (defensa ante eventos fuera de orden).
      const blob = await upload(`images/${safeBlobName(file.name)}`, file, {
        access: "private",
        handleUploadUrl: "/api/panel/images/upload",
        onUploadProgress: (p) => setProgress((cur) => Math.max(cur ?? 0, p.percentage)),
      });
      setUrl(blob.url);
      setPreview((p) => {
        if (p) URL.revokeObjectURL(p);
        return URL.createObjectURL(file);
      });
      setMediaType(file.type.startsWith("video") ? "video" : "image");
      setName(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir el medio");
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
        body: JSON.stringify({ url, type: mediaType, name: name.trim(), description: description.trim(), tags: parseTags(tags) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al guardar");
      reset();
      onAdded();
      toast.success(mediaType === "video" ? "Video agregado." : "Imagen agregada.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error al guardar";
      setErr(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-foreground">Agregar medio</div>

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
                ? progress >= 99
                  ? "Finalizando… casi listo"
                  : `Subiendo… ${Math.round(progress)}%`
                : "Subiendo…"
              : "Haz clic para subir una imagen (JPG/PNG/WEBP/GIF) o un video corto (MP4)"}
          </span>
          <span className="text-xs text-muted-foreground">Hasta 16 MB · el video debe ser corto</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/3gpp"
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
          {mediaType === "video" ? (
            <video src={preview ?? undefined} controls className="h-40 w-40 shrink-0 rounded-lg border border-border object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview ?? undefined} alt="" className="h-40 w-40 shrink-0 rounded-lg border border-border object-cover" />
          )}
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
  const confirm = useConfirm();

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
        toast.success("Imagen actualizada.");
      } else {
        toast.error(json.error?.message ?? "No se pudo actualizar.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const inUse = img.materialUses + img.qaUses;
    if (
      !(await confirm({
        title: `¿Borrar "${img.name}"?`,
        description: inUse
          ? `Está vinculado en ${usageLabel(img).replace("Usado en ", "")}; esos vínculos quedarán sin medio. Irreversible.`
          : "Esta acción no se puede deshacer.",
        confirmLabel: "Borrar",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    await fetch(`/api/panel/images?id=${img.id}`, { method: "DELETE" });
    onDelete();
    invalidateMediaCache();
    toast.success("Medio borrado.");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative">
        {img.type === "video" ? (
          <video src={img.url} controls className="h-40 w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={img.name} className="h-40 w-full object-cover" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {img.type === "video" ? "Video" : "Imagen"}
        </span>
      </div>
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
            <p
              className={cn(
                "mt-1.5 text-xs font-medium",
                img.materialUses + img.qaUses > 0 ? "text-success" : "text-muted-foreground",
              )}
            >
              {usageLabel(img)}
            </p>
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
