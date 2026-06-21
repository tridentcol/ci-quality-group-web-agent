"use client";

import { useEffect, useState } from "react";
import { ImageIcon, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Media {
  id: string;
  type: "image" | "video";
  name: string;
  url: string;
}

// Cache simple del banco de medios (se comparte entre instancias del picker).
let cache: Media[] | null = null;
const listeners = new Set<(m: Media[]) => void>();
async function loadMedia(): Promise<Media[]> {
  if (cache) return cache;
  const res = await fetch("/api/panel/images");
  const json = await res.json();
  cache = json.success ? json.data : [];
  listeners.forEach((l) => l(cache!));
  return cache!;
}

/**
 * Selector de un medio (imagen/video) del banco para vincularlo de forma fija a
 * un material o a una FAQ. `value` es el id del medio o null; `onChange` lo emite.
 */
export function MediaPicker({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}) {
  const [media, setMedia] = useState<Media[]>(cache ?? []);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadMedia().then(setMedia);
    listeners.add(setMedia);
    return () => {
      listeners.delete(setMedia);
    };
  }, []);

  const selected = media.find((m) => m.id === value) ?? null;

  return (
    <div>
      {label && <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-left text-sm"
        >
          {selected ? (
            <Thumb media={selected} />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : "Sin medio vinculado"}
          </span>
          {selected && (
            <X
              className="size-4 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {media.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No hay medios. Súbelos en “Medios”.
              </p>
            ) : (
              media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                    m.id === value && "bg-accent",
                  )}
                >
                  <Thumb media={m} />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.type === "video" ? "vid" : "img"}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Thumb({ media }: { media: Media }) {
  if (media.type === "video") {
    return <video src={media.url} className="size-7 shrink-0 rounded border border-border object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt="" className="size-7 shrink-0 rounded border border-border object-cover" />;
}

/** Invalida el cache del banco (tras subir/borrar medios). */
export function invalidateMediaCache() {
  cache = null;
}
