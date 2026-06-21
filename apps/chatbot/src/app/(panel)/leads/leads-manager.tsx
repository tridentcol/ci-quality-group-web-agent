"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelBadge } from "@/components/panel/channel-badge";

type Status = "new" | "contacted" | "quoted" | "won" | "lost";

interface Lead {
  id: string;
  name: string | null;
  contact: string | null;
  interest: string | null;
  materialName: string | null;
  quantity: string | null;
  requestedDiscount: boolean;
  discountApprovedPct: string | null;
  status: Status;
  notes: string | null;
  test: boolean;
  channel: string | null;
  createdAt: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  quoted: "Cotizado",
  won: "Ganado",
  lost: "Perdido",
};

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function LeadsManager() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideTest, setHideTest] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/leads");
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (u: Lead) => setItems((p) => p.map((x) => (x.id === u.id ? u : x)));

  const onDelete = async (id: string) => {
    if (!confirm("¿Borrar este lead?")) return;
    await fetch(`/api/panel/leads?id=${id}`, { method: "DELETE" });
    setItems((p) => p.filter((x) => x.id !== id));
  };

  const testCount = useMemo(() => items.filter((l) => l.test).length, [items]);
  const visible = hideTest ? items.filter((l) => !l.test) : items;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
        Cargando…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
        Aún no hay leads. El bot los captura cuando hay intención de compra/venta.
      </div>
    );
  }

  return (
    <>
      {testCount > 0 && (
        <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} />
          Ocultar leads de prueba ({testCount})
        </label>
      )}

      {/* Cards en móvil */}
      <div className="space-y-3 md:hidden">
        {visible.map((l) => (
          <LeadCard key={l.id} lead={l} onChange={onChange} onDelete={() => onDelete(l.id)} />
        ))}
      </div>

      {/* Tabla en escritorio */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
          Solicitudes
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-2 py-2 font-medium">Canal</th>
              <th className="px-2 py-2 font-medium">Interés</th>
              <th className="px-2 py-2 font-medium">Cant.</th>
              <th className="px-2 py-2 font-medium">Descuento</th>
              <th className="px-2 py-2 font-medium">Estado</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <LeadRow key={l.id} lead={l} onChange={onChange} onDelete={() => onDelete(l.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Etiqueta de lead de prueba (capturado desde el playground).
function TestBadge() {
  return (
    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
      Prueba
    </span>
  );
}

// Lógica de guardado compartida entre la fila (escritorio) y la tarjeta (móvil).
function useLeadPatch(lead: Lead, onChange: (l: Lead) => void) {
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/panel/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id, ...body }),
      });
      const json = await res.json();
      if (json.success) onChange(json.data);
    } finally {
      setBusy(false);
    }
  }
  return { busy, patch };
}

function DiscountControl({ lead, onChange }: { lead: Lead; onChange: (l: Lead) => void }) {
  const { busy, patch } = useLeadPatch(lead, onChange);
  const [discount, setDiscount] = useState(lead.discountApprovedPct ?? "");

  useEffect(() => setDiscount(lead.discountApprovedPct ?? ""), [lead.discountApprovedPct]);

  const dirty = (discount || null) !== (lead.discountApprovedPct ?? null);

  return (
    <div className="flex items-center gap-1.5">
      {lead.requestedDiscount && (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
          pidió
        </span>
      )}
      <input
        type="number"
        min={0}
        max={100}
        placeholder="%"
        value={discount}
        onChange={(e) => setDiscount(e.target.value)}
        className={cn(inputCls, "w-16")}
      />
      {dirty && (
        <button
          onClick={() => patch({ discountApprovedPct: discount === "" ? null : Number(discount) })}
          disabled={busy}
          className="inline-flex items-center rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          aria-label="Aprobar descuento"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

function StatusControl({
  lead,
  onChange,
  className,
}: {
  lead: Lead;
  onChange: (l: Lead) => void;
  className?: string;
}) {
  const { busy, patch } = useLeadPatch(lead, onChange);
  return (
    <select
      value={lead.status}
      disabled={busy}
      onChange={(e) => patch({ status: e.target.value })}
      className={cn(inputCls, className)}
    >
      {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

function LeadRow({
  lead,
  onChange,
  onDelete,
}: {
  lead: Lead;
  onChange: (l: Lead) => void;
  onDelete: () => void;
}) {
  return (
    <tr className={cn("border-b border-border/60 align-top last:border-0", lead.test && "bg-warning/5")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{lead.name ?? "—"}</span>
          {lead.test && <TestBadge />}
        </div>
        <div className="text-xs text-muted-foreground">{lead.contact ?? "sin contacto"}</div>
      </td>
      <td className="px-2 py-3">
        <ChannelBadge channel={lead.channel} />
      </td>
      <td className="px-2 py-3 text-foreground">{lead.interest ?? lead.materialName ?? "—"}</td>
      <td className="px-2 py-3 text-muted-foreground">{lead.quantity ?? "—"}</td>
      <td className="px-2 py-3">
        <DiscountControl lead={lead} onChange={onChange} />
      </td>
      <td className="px-2 py-3">
        <StatusControl lead={lead} onChange={onChange} />
      </td>
      <td className="px-2 py-3 text-right">
        <button
          onClick={onDelete}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Borrar lead"
        >
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  );
}

function LeadCard({
  lead,
  onChange,
  onDelete,
}: {
  lead: Lead;
  onChange: (l: Lead) => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", lead.test && "bg-warning/5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{lead.name ?? "—"}</span>
            {lead.test && <TestBadge />}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {lead.contact ?? "sin contacto"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChannelBadge channel={lead.channel} />
          <button
            onClick={onDelete}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Borrar lead"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Interés</dt>
          <dd className="text-foreground">{lead.interest ?? lead.materialName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cantidad</dt>
          <dd className="text-foreground">{lead.quantity ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-2">
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Descuento</span>
          <DiscountControl lead={lead} onChange={onChange} />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Estado</span>
          <StatusControl lead={lead} onChange={onChange} className="w-full" />
        </div>
      </div>
    </div>
  );
}
