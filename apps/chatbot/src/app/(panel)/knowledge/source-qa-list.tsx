"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/panel/confirm-dialog";

interface Qa {
  id: string;
  question: string;
  answer: string;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

// Lista editable de las preguntas frecuentes de una fuente: el admin puede
// mejorar la respuesta, corregir la pregunta, agregar a mano, borrar o regenerar.
// onChanged refresca el conteo en la lista de fuentes del panel.
export function SourceQaList({
  sourceId,
  onChanged,
}: {
  sourceId: string;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Qa[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch(`/api/panel/knowledge/qa?sourceId=${sourceId}`);
    const json = await res.json();
    if (json.success) setItems(json.data);
    else setItems([]);
  }, [sourceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerate() {
    if (!(await confirm({ title: "¿Regenerar las preguntas?", description: "Reemplaza las actuales generándolas desde el documento (usa la IA, ~½ centavo).", confirmLabel: "Regenerar" }))) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/panel/knowledge/qa/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const json = await res.json();
      await load();
      onChanged?.();
      if (json.success) toast.success(`Regeneradas: ${json.data.count} pregunta(s).`);
      else toast.error(json.error?.message ?? "No se pudo regenerar.");
    } finally {
      setRegenerating(false);
    }
  }

  if (items === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando preguntas…
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          {items.length} pregunta{items.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="size-3.5" /> Agregar
          </button>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Regenerar
          </button>
        </div>
      </div>

      {adding && (
        <QaEditor
          initial={{ question: "", answer: "" }}
          onCancel={() => setAdding(false)}
          onSave={async (q, a) => {
            const res = await fetch("/api/panel/knowledge/qa", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sourceId, question: q, answer: a }),
            });
            const json = await res.json();
            if (json.success) {
              setItems((p) => [...(p ?? []), json.data]);
              setAdding(false);
              onChanged?.();
              toast.success("Pregunta agregada.");
            }
            return json.success;
          }}
        />
      )}

      {items.length === 0 && !adding ? (
        <p className="py-2 text-sm text-muted-foreground">
          Sin preguntas. Agrega una a mano o regenera desde el documento.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((qa) => (
            <QaRow
              key={qa.id}
              qa={qa}
              onUpdated={(u) => setItems((p) => (p ?? []).map((x) => (x.id === u.id ? u : x)))}
              onDeleted={() => {
                setItems((p) => (p ?? []).filter((x) => x.id !== qa.id));
                onChanged?.();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function QaRow({
  qa,
  onUpdated,
  onDeleted,
}: {
  qa: Qa;
  onUpdated: (q: Qa) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function remove() {
    if (!(await confirm({ title: "¿Borrar esta pregunta?", confirmLabel: "Borrar", destructive: true }))) return;
    setBusy(true);
    await fetch(`/api/panel/knowledge/qa?id=${qa.id}`, { method: "DELETE" });
    onDeleted();
    toast.success("Pregunta borrada.");
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-primary/40 bg-background p-3">
        <QaEditor
          initial={{ question: qa.question, answer: qa.answer }}
          onCancel={() => setEditing(false)}
          onSave={async (q, a) => {
            const res = await fetch("/api/panel/knowledge/qa", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ id: qa.id, question: q, answer: a }),
            });
            const json = await res.json();
            if (json.success) {
              onUpdated(json.data);
              setEditing(false);
              toast.success("Pregunta actualizada.");
            }
            return json.success;
          }}
        />
      </li>
    );
  }

  return (
    <li className="group rounded-lg border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{qa.question}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground transition-colors hover:text-primary"
            aria-label="Editar pregunta"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Borrar pregunta"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 pl-6 text-sm text-muted-foreground">{qa.answer}</p>
    </li>
  );
}

// Editor de un par pregunta/respuesta (alta o edición).
function QaEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: { question: string; answer: string };
  onSave: (question: string, answer: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial.question);
  const [answer, setAnswer] = useState(initial.answer);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!question.trim() || !answer.trim()) {
      setErr("Pregunta y respuesta son obligatorias.");
      return;
    }
    setBusy(true);
    setErr(null);
    const okDone = await onSave(question.trim(), answer.trim());
    setBusy(false);
    if (!okDone) setErr("No se pudo guardar.");
  }

  return (
    <div className="mb-2 space-y-2">
      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Pregunta</span>
        <input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Respuesta del bot</span>
        <textarea
          rows={3}
          className={cn(inputCls, "resize-y")}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {err && <p className="mr-auto text-xs text-destructive">{err}</p>}
        <button
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-60"
        >
          <X className="size-3.5" /> Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
