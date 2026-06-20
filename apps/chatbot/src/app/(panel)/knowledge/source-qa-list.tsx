"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircleQuestion } from "lucide-react";

interface Qa {
  id: string;
  question: string;
  answer: string;
}

// Lista expandible de las preguntas frecuentes generadas de una fuente: muestra
// el "valor extraído" del documento (qué puede responder el bot con él).
export function SourceQaList({ sourceId }: { sourceId: string }) {
  const [items, setItems] = useState<Qa[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/panel/knowledge/qa?sourceId=${sourceId}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.success) setItems(j.data);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [sourceId]);

  if (items === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando preguntas…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Aún no hay preguntas para esta fuente.
      </p>
    );
  }

  return (
    <ul className="space-y-3 px-4 py-3">
      {items.map((qa) => (
        <li key={qa.id} className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start gap-2">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">{qa.question}</p>
          </div>
          <p className="mt-1.5 pl-6 text-sm text-muted-foreground">{qa.answer}</p>
        </li>
      ))}
    </ul>
  );
}
