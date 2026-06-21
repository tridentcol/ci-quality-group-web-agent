"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Plus, Pencil, Trash2, Check, X, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/panel/confirm-dialog";

const TOOL_OPTIONS = [
  { id: "lookup_price", label: "lookup_price" },
  { id: "list_materials", label: "list_materials" },
  { id: "capture_lead", label: "capture_lead" },
  { id: "request_human_handoff", label: "handoff" },
  { id: "get_location", label: "get_location" },
  { id: "find_image", label: "find_image" },
  { id: "log_knowledge_gap", label: "log_gap" },
];

interface Expectations {
  expectTools?: string[];
  forbidTools?: string[];
  expectContext?: "any" | "with" | "without";
  replyIncludes?: string;
  replyExcludes?: string;
}
interface Scenario {
  id: string;
  name: string;
  messages: string[];
  expectations: Expectations;
}
interface RunResult {
  pass: boolean;
  details: string[];
  reply: string;
  tools: string[];
  contextUsed: boolean;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function Scenarios() {
  const [items, setItems] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Scenario | "new" | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [runningAll, setRunningAll] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/scenarios");
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAll() {
    setRunningAll(true);
    try {
      const res = await fetch("/api/panel/scenarios/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        const map: Record<string, RunResult> = {};
        for (const r of json.data) map[r.id] = r;
        setResults((prev) => ({ ...prev, ...map }));
        const passed = json.data.filter((r: { pass: boolean }) => r.pass).length;
        toast.success(`${passed}/${json.data.length} escenarios en verde`);
      } else toast.error(json.error?.message ?? "Error al correr");
    } finally {
      setRunningAll(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "¿Borrar este escenario?", confirmLabel: "Borrar", destructive: true }))) return;
    await fetch(`/api/panel/scenarios?id=${id}`, { method: "DELETE" });
    setItems((p) => p.filter((x) => x.id !== id));
    toast.success("Escenario borrado.");
  }

  if (editing) {
    return (
      <ScenarioEditor
        scenario={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Define conversaciones esperadas y córrelas con un botón (pass/fail). No crea leads ni huecos.
        </p>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={runAll}
              disabled={runningAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              {runningAll ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Correr todo
            </button>
          )}
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Nuevo
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">
          Sin escenarios. Crea el primero (ej. “precio de cobre → usa lookup_price”).
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <ScenarioRow
              key={s.id}
              scenario={s}
              result={results[s.id]}
              onResult={(r) => setResults((prev) => ({ ...prev, [s.id]: r }))}
              onEdit={() => setEditing(s)}
              onDelete={() => remove(s.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ScenarioRow({
  scenario,
  result,
  onResult,
  onEdit,
  onDelete,
}: {
  scenario: Scenario;
  result?: RunResult;
  onResult: (r: RunResult) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/panel/scenarios/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: scenario.id }),
      });
      const json = await res.json();
      if (json.success && json.data[0]) {
        onResult(json.data[0]);
        toast[json.data[0].pass ? "success" : "error"](
          json.data[0].pass ? "Escenario en verde" : "Escenario falló",
        );
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {result &&
              (result.pass ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="size-4 shrink-0 text-destructive" />
              ))}
            <span className="font-medium text-foreground">{scenario.name}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {scenario.messages.join(" → ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={run} disabled={running} className="text-muted-foreground hover:text-primary" aria-label="Correr">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          </button>
          <button onClick={onEdit} className="text-muted-foreground hover:text-primary" aria-label="Editar">
            <Pencil className="size-4" />
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive" aria-label="Borrar">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {result && !result.pass && (
        <ul className="mt-2 space-y-0.5 rounded-md bg-destructive/5 p-2 text-xs text-destructive">
          {result.details.map((d, i) => (
            <li key={i}>· {d}</li>
          ))}
        </ul>
      )}
      {result && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Respuesta:</span> {result.reply}
          {result.tools.length > 0 && <> · tools: {result.tools.join(", ")}</>}
        </p>
      )}
    </li>
  );
}

function ScenarioEditor({
  scenario,
  onClose,
  onSaved,
}: {
  scenario: Scenario | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(scenario?.name ?? "");
  const [messagesText, setMessagesText] = useState((scenario?.messages ?? []).join("\n"));
  const [exp, setExp] = useState<Expectations>(scenario?.expectations ?? { expectContext: "any" });
  const [busy, setBusy] = useState(false);

  const toggle = (key: "expectTools" | "forbidTools", tool: string) =>
    setExp((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(tool) ? cur.filter((t) => t !== tool) : [...cur, tool] };
    });

  async function save() {
    const messages = messagesText.split("\n").map((m) => m.trim()).filter(Boolean);
    if (!name.trim()) return toast.error("Ponle un nombre.");
    if (messages.length === 0) return toast.error("Agrega al menos un mensaje.");
    setBusy(true);
    try {
      const res = await fetch("/api/panel/scenarios", {
        method: scenario ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(scenario ? { id: scenario.id } : {}),
          name: name.trim(),
          messages,
          expectations: {
            ...exp,
            replyIncludes: exp.replyIncludes?.trim() || undefined,
            replyExcludes: exp.replyExcludes?.trim() || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al guardar");
      toast.success("Escenario guardado.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/40 bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {scenario ? "Editar escenario" : "Nuevo escenario"}
      </h2>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Mensajes del cliente (uno por línea, en orden)
        </span>
        <textarea
          rows={3}
          className={cn(inputCls, "resize-y")}
          placeholder={"hola, venden cobre?\na cómo el kilo si llevo 200kg?"}
          value={messagesText}
          onChange={(e) => setMessagesText(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ToolPicker label="Debe usar (alguna)" selected={exp.expectTools ?? []} onToggle={(t) => toggle("expectTools", t)} />
        <ToolPicker label="No debe usar" selected={exp.forbidTools ?? []} onToggle={(t) => toggle("forbidTools", t)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Contexto RAG</span>
          <select
            className={inputCls}
            value={exp.expectContext ?? "any"}
            onChange={(e) => setExp((p) => ({ ...p, expectContext: e.target.value as Expectations["expectContext"] }))}
          >
            <option value="any">Indiferente</option>
            <option value="with">Debe recuperar</option>
            <option value="without">No debe recuperar</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">La respuesta incluye…</span>
          <input className={inputCls} value={exp.replyIncludes ?? ""} onChange={(e) => setExp((p) => ({ ...p, replyIncludes: e.target.value }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">…y NO incluye</span>
          <input className={inputCls} value={exp.replyExcludes ?? ""} onChange={(e) => setExp((p) => ({ ...p, replyExcludes: e.target.value }))} />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-60">
          <X className="size-4" /> Cancelar
        </button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar
        </button>
      </div>
    </div>
  );
}

function ToolPicker({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: string[];
  onToggle: (tool: string) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {TOOL_OPTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
              selected.includes(t.id)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
