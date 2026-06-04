"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
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

  const load = useCallback(async () => {
    const res = await fetch("/api/panel/leads");
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
        Solicitudes
      </div>
      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Aún no hay leads. El bot los captura cuando hay intención de compra/venta.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-2 py-2 font-medium">Canal</th>
              <th className="px-2 py-2 font-medium">Interés</th>
              <th className="px-2 py-2 font-medium">Cant.</th>
              <th className="px-2 py-2 font-medium">Descuento</th>
              <th className="px-2 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <LeadRow key={l.id} lead={l} onChange={(u) => setItems((p) => p.map((x) => (x.id === u.id ? u : x)))} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LeadRow({ lead, onChange }: { lead: Lead; onChange: (l: Lead) => void }) {
  const [discount, setDiscount] = useState(lead.discountApprovedPct ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => setDiscount(lead.discountApprovedPct ?? ""), [lead.discountApprovedPct]);

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

  const discountDirty = (discount || null) !== (lead.discountApprovedPct ?? null);

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{lead.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{lead.contact ?? "sin contacto"}</div>
      </td>
      <td className="px-2 py-3">
        <ChannelBadge channel={lead.channel} />
      </td>
      <td className="px-2 py-3 text-foreground">{lead.interest ?? lead.materialName ?? "—"}</td>
      <td className="px-2 py-3 text-muted-foreground">{lead.quantity ?? "—"}</td>
      <td className="px-2 py-3">
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
          {discountDirty && (
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
      </td>
      <td className="px-2 py-3">
        <select
          value={lead.status}
          disabled={busy}
          onChange={(e) => patch({ status: e.target.value })}
          className={inputCls}
        >
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
