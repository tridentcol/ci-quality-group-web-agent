"use client";

import { useState } from "react";
import { Loader2, X, Plus, Trash2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface LeadLite {
  id: string;
  name: string | null;
  contact: string | null;
  interest: string | null;
  materialName: string | null;
  quantity: string | null;
  unit: string | null;
  agreedPriceCop: string | null;
}
interface Line {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function QuoteModal({ lead, onClose }: { lead: LeadLite; onClose: () => void }) {
  const qty = lead.quantity ? Number(lead.quantity) : null;
  const agreed = lead.agreedPriceCop ? Number(lead.agreedPriceCop) : null;
  // Precio unitario sugerido: si hay total acordado y cantidad, se divide; si no, el acordado.
  const unitGuess = agreed != null ? (qty && qty > 0 ? Math.round(agreed / qty) : agreed) : 0;

  const [customerName, setCustomerName] = useState(lead.name ?? "");
  const [customerContact, setCustomerContact] = useState(lead.contact ?? "");
  const [lines, setLines] = useState<Line[]>([
    {
      description: lead.interest ?? lead.materialName ?? "",
      quantity: lead.quantity ?? "",
      unit: lead.unit ?? "",
      unitPrice: unitGuess ? String(unitGuess) : "",
    },
  ]);
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState("8");
  const [busy, setBusy] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((p) => [...p, { description: "", quantity: "", unit: "", unitPrice: "" }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const total = lines.reduce((a, l) => {
    const up = Number(l.unitPrice) || 0;
    const q = l.quantity.trim() === "" ? 1 : Number(l.quantity) || 0;
    return a + up * q;
  }, 0);

  async function create() {
    const items = lines
      .filter((l) => l.description.trim() && l.unitPrice.trim() !== "")
      .map((l) => ({
        description: l.description.trim(),
        quantity: l.quantity.trim() === "" ? null : Number(l.quantity),
        unit: l.unit.trim() || undefined,
        unitPriceCop: Number(l.unitPrice),
      }));
    if (!items.length) {
      toast.error("Agrega al menos una línea con descripción y precio.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/panel/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          customerName,
          customerContact,
          items,
          notes,
          validDays: Number(validDays) || 8,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Cotización #${json.data.ref} creada.`);
        window.open(`/cotizacion/${json.data.id}`, "_blank");
        onClose();
      } else {
        toast.error(json.error?.message ?? "No se pudo crear.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-primary" /> Nueva cotización
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Cliente
            <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Contacto
            <input className={inputCls} value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
          </label>
        </div>

        <div className="mt-3 space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Líneas</span>
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-border p-2">
              <input className={inputCls} placeholder="Descripción (ej. Lámina trapezoidal)" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
              <div className="mt-1.5 flex items-center gap-1.5">
                <input className={inputCls} type="number" min={0} placeholder="Cant." value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                <input className={inputCls} placeholder="Unid." value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                <input className={inputCls} type="number" min={0} placeholder="Precio unit." value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} aria-label="Quitar línea" className="shrink-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Plus className="size-3.5" /> Agregar línea
          </button>
        </div>

        <label className="mt-3 block text-xs text-muted-foreground">Notas (opcional)
          <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="mt-2 block w-32 text-xs text-muted-foreground">Vigencia (días)
          <input className={inputCls} type="number" min={1} value={validDays} onChange={(e) => setValidDays(e.target.value)} />
        </label>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm text-foreground">Total: <b>{total.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}</b></span>
          <button
            onClick={create}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            Crear y abrir
          </button>
        </div>
      </div>
    </div>
  );
}
