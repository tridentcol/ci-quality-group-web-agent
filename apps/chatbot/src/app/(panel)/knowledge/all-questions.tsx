"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, BookOpen } from "lucide-react";
import { QaRow, type Qa } from "./source-qa-list";

interface GlobalQa extends Qa {
  sourceId: string;
  sourceName: string;
}

// Vista global: TODAS las preguntas extraídas de las fuentes, agrupadas por
// fuente y editables aquí mismo. Reusa <QaRow> y la misma API que la vista por
// fuente → editar/borrar aquí escribe la MISMA fila (fuente única de verdad), así
// que el cambio se refleja en ambas vistas. onChanged refresca el panel de fuentes.
export function AllQuestions({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<GlobalQa[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/knowledge/qa");
    const json = await res.json();
    setItems(json.success ? json.data : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !items) return items ?? [];
    return items.filter(
      (x) => x.question.toLowerCase().includes(term) || x.answer.toLowerCase().includes(term),
    );
  }, [items, q]);

  // Agrupar por fuente, preservando el orden de llegada.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: GlobalQa[] }>();
    for (const x of filtered) {
      const g = map.get(x.sourceId) ?? { name: x.sourceName, rows: [] };
      g.rows.push(x);
      map.set(x.sourceId, g);
    }
    return [...map.values()];
  }, [filtered]);

  if (items === null) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando preguntas…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
        Aún no hay preguntas. Sube una fuente y, al quedar &quot;Listo&quot;, aquí verás sus preguntas.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar en preguntas y respuestas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {filtered.length} de {items.length}
        </span>
      </div>

      {groups.map((g, gi) => (
        <div key={gi} className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <BookOpen className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{g.name}</span>
            <span className="text-xs text-muted-foreground">· {g.rows.length}</span>
          </div>
          <ul className="space-y-2 p-3">
            {g.rows.map((qa) => (
              <QaRow
                key={qa.id}
                qa={qa}
                onUpdated={(u) =>
                  setItems((p) =>
                    (p ?? []).map((x) => (x.id === u.id ? { ...x, ...u } : x)),
                  )
                }
                onDeleted={() => {
                  setItems((p) => (p ?? []).filter((x) => x.id !== qa.id));
                  onChanged?.();
                }}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
