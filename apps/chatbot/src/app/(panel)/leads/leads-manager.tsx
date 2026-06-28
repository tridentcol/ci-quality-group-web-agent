"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Check, Trash2, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChannelBadge } from "@/components/panel/channel-badge";
import { useConfirm } from "@/components/panel/confirm-dialog";

type Status = "new" | "contacted" | "quoted" | "ready" | "won" | "lost";

interface Lead {
  id: string;
  ref: number;
  conversationId: string | null;
  name: string | null;
  contact: string | null;
  interest: string | null;
  materialName: string | null;
  quantity: string | null;
  unit: string | null;
  agreedPriceCop: string | null;
  fulfillment: string | null;
  scheduledFor: string | null;
  paymentMethod: string | null;
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
  ready: "Por cerrar",
  won: "Ganado",
  lost: "Perdido",
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

// Resumen de cantidad con unidad (ej. "300 kg").
function qtyLabel(lead: Lead): string {
  if (!lead.quantity) return "—";
  return `${lead.quantity}${lead.unit ? " " + lead.unit : ""}`;
}

// Botón-enlace a la conversación del lead (si tiene hilo real).
function ConvLink({ conversationId }: { conversationId: string | null }) {
  if (!conversationId) return null;
  return (
    <Link
      href={`/conversations/${conversationId}`}
      className="inline-flex items-center text-muted-foreground transition-colors hover:text-primary"
      aria-label="Abrir conversación"
      title="Abrir conversación"
    >
      <MessageSquare className="size-4" />
    </Link>
  );
}

export function LeadsManager() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideTest, setHideTest] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const confirm = useConfirm();

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
    if (!(await confirm({ title: "¿Borrar este lead?", confirmLabel: "Borrar", destructive: true }))) return;
    await fetch(`/api/panel/leads?id=${id}`, { method: "DELETE" });
    setItems((p) => p.filter((x) => x.id !== id));
    toast.success("Lead borrado.");
  };

  const testCount = useMemo(() => items.filter((l) => l.test).length, [items]);

  // Buscador (nombre/contacto/interés/#ref) + filtro de estado + ocultar prueba.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qNum = q.replace(/^#/, "");
    return items.filter((l) => {
      if (hideTest && l.test) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(l.ref) === qNum ||
        [l.name, l.contact, l.interest, l.materialName, l.fulfillment]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q))
      );
    });
  }, [items, query, statusFilter, hideTest]);

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
      {/* Buscador + filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar por #, nombre, contacto, interés…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(inputCls, "w-full pl-8")}
          />
        </div>
        <select
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | Status)}
          className={inputCls}
        >
          <option value="all">Todos los estados</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{visible.length} de {items.length}</span>
      </div>

      {testCount > 0 && (
        <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} />
          Ocultar leads de prueba ({testCount})
        </label>
      )}

      {visible.length === 0 && (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
          Ningún lead coincide con la búsqueda o el filtro.
        </p>
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
              <th className="px-2 py-2 font-medium">Acordado</th>
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
      if (json.success) {
        onChange(json.data);
        toast.success("Lead actualizado.");
      } else {
        toast.error(json.error?.message ?? "No se pudo actualizar.");
      }
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
        aria-label="Descuento aprobado (%)"
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
      aria-label="Estado del lead"
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
          <span className="font-mono text-xs text-muted-foreground">#{lead.ref}</span>
          <span className="font-medium text-foreground">{lead.name ?? "—"}</span>
          {lead.test && <TestBadge />}
        </div>
        <div className="text-xs text-muted-foreground">{lead.contact ?? "sin contacto"}</div>
        {(lead.fulfillment || lead.scheduledFor || lead.paymentMethod) && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[lead.fulfillment, lead.scheduledFor, lead.paymentMethod].filter(Boolean).join(" · ")}
          </div>
        )}
      </td>
      <td className="px-2 py-3">
        <ChannelBadge channel={lead.channel} />
      </td>
      <td className="px-2 py-3 text-foreground">{lead.interest ?? lead.materialName ?? "—"}</td>
      <td className="px-2 py-3 text-muted-foreground">{qtyLabel(lead)}</td>
      <td className="px-2 py-3 text-foreground">
        {lead.agreedPriceCop ? cop.format(Number(lead.agreedPriceCop)) : "—"}
      </td>
      <td className="px-2 py-3">
        <DiscountControl lead={lead} onChange={onChange} />
      </td>
      <td className="px-2 py-3">
        <StatusControl lead={lead} onChange={onChange} />
      </td>
      <td className="px-2 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <ConvLink conversationId={lead.conversationId} />
          <button
            onClick={onDelete}
            className="-m-1.5 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Borrar lead"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
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
            <span className="font-mono text-xs text-muted-foreground">#{lead.ref}</span>
            <span className="truncate font-medium text-foreground">{lead.name ?? "—"}</span>
            {lead.test && <TestBadge />}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {lead.contact ?? "sin contacto"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConvLink conversationId={lead.conversationId} />
          <ChannelBadge channel={lead.channel} />
          <button
            onClick={onDelete}
            className="-m-1.5 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
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
          <dd className="text-foreground">{qtyLabel(lead)}</dd>
        </div>
        {lead.agreedPriceCop && (
          <div>
            <dt className="text-xs text-muted-foreground">Precio acordado</dt>
            <dd className="font-medium text-foreground">{cop.format(Number(lead.agreedPriceCop))}</dd>
          </div>
        )}
        {lead.fulfillment && (
          <div>
            <dt className="text-xs text-muted-foreground">Logística</dt>
            <dd className="text-foreground">{lead.fulfillment}</dd>
          </div>
        )}
        {lead.scheduledFor && (
          <div>
            <dt className="text-xs text-muted-foreground">Fecha/horario</dt>
            <dd className="text-foreground">{lead.scheduledFor}</dd>
          </div>
        )}
        {lead.paymentMethod && (
          <div>
            <dt className="text-xs text-muted-foreground">Pago</dt>
            <dd className="text-foreground">{lead.paymentMethod}</dd>
          </div>
        )}
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
