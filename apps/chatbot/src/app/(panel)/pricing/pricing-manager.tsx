"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Unit = "kg" | "ton" | "unidad";

interface Material {
  id: string;
  name: string;
  category: string | null;
  unit: Unit;
  retailPriceCop: string;
  wholesalePriceCop: string | null;
  wholesaleThreshold: string | null;
  active: boolean;
  updatedAt: string | null;
}

const UNITS: Unit[] = ["kg", "ton", "unidad"];
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

const inputCls =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function PricingManager() {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/pricing");
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (u: Material) => setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  const onDelete = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="space-y-8">
      <AddCard onAdded={(m) => setItems((prev) => [m, ...prev])} />

      {loading ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Cargando…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Aún no hay materiales. Agrega el primero arriba.
        </p>
      ) : (
        <>
          {/* Cards en móvil */}
          <div className="space-y-3 md:hidden">
            {items.map((m) => (
              <PriceCard key={m.id} material={m} onChange={onChange} onDelete={() => onDelete(m.id)} />
            ))}
          </div>

          {/* Tabla en escritorio */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
              Materiales
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Material</th>
                  <th className="px-2 py-2 font-medium">Unidad</th>
                  <th className="px-2 py-2 font-medium">Minorista</th>
                  <th className="px-2 py-2 font-medium">Mayorista</th>
                  <th className="px-2 py-2 font-medium">Umbral</th>
                  <th className="px-2 py-2 font-medium">Activo</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <PriceRow
                    key={m.id}
                    material={m}
                    onChange={onChange}
                    onDelete={() => onDelete(m.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Estado y acciones de edición de un material, compartidos entre fila y tarjeta.
function usePriceEditor(
  material: Material,
  onChange: (m: Material) => void,
  onDelete: () => void,
) {
  const [draft, setDraft] = useState(material);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setDraft(material), [material]);

  const dirty =
    draft.name !== material.name ||
    (draft.category ?? "") !== (material.category ?? "") ||
    draft.unit !== material.unit ||
    draft.retailPriceCop !== material.retailPriceCop ||
    (draft.wholesalePriceCop ?? "") !== (material.wholesalePriceCop ?? "") ||
    (draft.wholesaleThreshold ?? "") !== (material.wholesaleThreshold ?? "");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/pricing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: material.id, ...body }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al guardar");
      onChange(json.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft.name.trim() || draft.retailPriceCop.trim() === "") {
      setErr("Nombre y precio minorista son obligatorios.");
      return;
    }
    await patch({
      name: draft.name.trim(),
      category: draft.category?.trim() || null,
      unit: draft.unit,
      retailPriceCop: Number(draft.retailPriceCop),
      wholesalePriceCop: numOrNull(draft.wholesalePriceCop ?? ""),
      wholesaleThreshold: numOrNull(draft.wholesaleThreshold ?? ""),
    });
  }

  async function remove() {
    if (!confirm(`¿Borrar "${material.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/panel/pricing?id=${material.id}`, { method: "DELETE" });
    onDelete();
  }

  return { draft, setDraft, busy, err, dirty, patch, save, remove };
}

function ActiveToggle({
  active,
  busy,
  onToggle,
}: {
  active: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={busy}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        active ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 transform rounded-full bg-white transition-transform",
          active ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SaveBtn({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      Guardar
    </button>
  );
}

function PriceRow({
  material,
  onChange,
  onDelete,
}: {
  material: Material;
  onChange: (m: Material) => void;
  onDelete: () => void;
}) {
  const { draft, setDraft, busy, err, dirty, patch, save, remove } = usePriceEditor(
    material,
    onChange,
    onDelete,
  );

  return (
    <tr className={cn("border-b border-border/60 last:border-0", !draft.active && "opacity-60")}>
      <td className="px-4 py-2 align-top">
        <input
          className={inputCls}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          className={cn(inputCls, "mt-1 text-xs text-muted-foreground")}
          placeholder="Categoría (opcional)"
          value={draft.category ?? ""}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        />
        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      </td>
      <td className="px-2 py-2 align-top">
        <select
          className={inputCls}
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="number"
          min={0}
          className={cn(inputCls, "w-28")}
          value={draft.retailPriceCop}
          onChange={(e) => setDraft({ ...draft, retailPriceCop: e.target.value })}
        />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {draft.retailPriceCop ? cop.format(Number(draft.retailPriceCop)) : "—"}
        </p>
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="number"
          min={0}
          className={cn(inputCls, "w-28")}
          value={draft.wholesalePriceCop ?? ""}
          onChange={(e) => setDraft({ ...draft, wholesalePriceCop: e.target.value })}
        />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {draft.wholesalePriceCop ? cop.format(Number(draft.wholesalePriceCop)) : "—"}
        </p>
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="number"
          min={0}
          className={cn(inputCls, "w-24")}
          placeholder="—"
          value={draft.wholesaleThreshold ?? ""}
          onChange={(e) => setDraft({ ...draft, wholesaleThreshold: e.target.value })}
        />
      </td>
      <td className="px-2 py-2 align-top">
        <ActiveToggle active={draft.active} busy={busy} onToggle={() => patch({ active: !draft.active })} />
      </td>
      <td className="px-4 py-2 align-top text-right">
        <div className="flex items-center justify-end gap-2">
          {dirty && <SaveBtn busy={busy} onClick={save} />}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Borrar material"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function PriceCard({
  material,
  onChange,
  onDelete,
}: {
  material: Material;
  onChange: (m: Material) => void;
  onDelete: () => void;
}) {
  const { draft, setDraft, busy, err, dirty, patch, save, remove } = usePriceEditor(
    material,
    onChange,
    onDelete,
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        !draft.active && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <input
          className={inputCls}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <ActiveToggle active={draft.active} busy={busy} onToggle={() => patch({ active: !draft.active })} />
      </div>
      <input
        className={cn(inputCls, "mt-2 text-xs text-muted-foreground")}
        placeholder="Categoría (opcional)"
        value={draft.category ?? ""}
        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
      />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Unidad</span>
          <select
            className={inputCls}
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Umbral mayoreo</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            placeholder="—"
            value={draft.wholesaleThreshold ?? ""}
            onChange={(e) => setDraft({ ...draft, wholesaleThreshold: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Minorista</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={draft.retailPriceCop}
            onChange={(e) => setDraft({ ...draft, retailPriceCop: e.target.value })}
          />
          <p className="mt-0.5 text-xs text-muted-foreground">
            {draft.retailPriceCop ? cop.format(Number(draft.retailPriceCop)) : "—"}
          </p>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Mayorista</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={draft.wholesalePriceCop ?? ""}
            onChange={(e) => setDraft({ ...draft, wholesalePriceCop: e.target.value })}
          />
          <p className="mt-0.5 text-xs text-muted-foreground">
            {draft.wholesalePriceCop ? cop.format(Number(draft.wholesalePriceCop)) : "—"}
          </p>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {err ? <p className="text-xs text-destructive">{err}</p> : <span />}
        <div className="flex items-center gap-2">
          {dirty && <SaveBtn busy={busy} onClick={save} />}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Borrar material"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCard({ onAdded }: { onAdded: (m: Material) => void }) {
  const empty = { name: "", category: "", unit: "kg" as Unit, retail: "", wholesale: "", threshold: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || f.retail.trim() === "") {
      setErr("Nombre y precio minorista son obligatorios.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          category: f.category.trim() || null,
          unit: f.unit,
          retailPriceCop: Number(f.retail),
          wholesalePriceCop: numOrNull(f.wholesale),
          wholesaleThreshold: numOrNull(f.threshold),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al crear");
      onAdded(json.data);
      setF(empty);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error al crear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-foreground">Agregar material</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <input
          className={cn(inputCls, "col-span-2")}
          placeholder="Nombre (ej. Cobre #1)"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <input
          className={cn(inputCls, "col-span-2 sm:col-span-1")}
          placeholder="Categoría"
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        />
        <select
          className={inputCls}
          value={f.unit}
          onChange={(e) => setF({ ...f, unit: e.target.value as Unit })}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          className={inputCls}
          placeholder="Minorista"
          value={f.retail}
          onChange={(e) => setF({ ...f, retail: e.target.value })}
        />
        <input
          type="number"
          min={0}
          className={inputCls}
          placeholder="Mayorista"
          value={f.wholesale}
          onChange={(e) => setF({ ...f, wholesale: e.target.value })}
        />
        <input
          type="number"
          min={0}
          className={inputCls}
          placeholder="Umbral mayoreo"
          value={f.threshold}
          onChange={(e) => setF({ ...f, threshold: e.target.value })}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        {err ? <p className="text-sm text-destructive">{err}</p> : <span />}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar
        </button>
      </div>
    </form>
  );
}
