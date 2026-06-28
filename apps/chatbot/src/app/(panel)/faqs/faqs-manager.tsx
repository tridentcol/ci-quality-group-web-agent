"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SourceQaList } from "../knowledge/source-qa-list";

/**
 * FAQs rápidas: asegura la fuente "manual" y reusa <SourceQaList> (mismo editor de
 * Q&A que el conocimiento: agregar, editar, borrar, adjuntar medio). Las preguntas
 * se embeben y el bot las usa por RAG igual que cualquier otra fuente.
 */
export function FaqsManager() {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/panel/faqs/source")
      .then((r) => r.json())
      .then((j) => (j.success ? setSourceId(j.data.id) : setErr(true)))
      .catch(() => setErr(true));
  }, []);

  if (err) {
    return (
      <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
        No se pudo preparar las FAQs. Reintenta recargando la página.
      </p>
    );
  }
  if (!sourceId) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparando…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <SourceQaList sourceId={sourceId} />
    </div>
  );
}
