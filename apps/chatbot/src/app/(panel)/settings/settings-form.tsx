"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BusinessHours {
  days: number[];
  open: string;
  close: string;
}
export interface Channels {
  messenger: boolean;
  whatsapp: boolean;
  instagram: boolean;
}
export interface SettingsInitial {
  botName: string;
  tonePrompt: string;
  welcomeMessage: string;
  afterHoursMessage: string;
  businessHours: BusinessHours | null;
  channelsEnabled: Channels;
  adminWhatsapp: string | null;
  locationName: string | null;
  locationAddress: string | null;
  locationLat: number | string | null;
  locationLng: number | string | null;
  locationMapsUrl: string | null;
  retentionMonths: number;
  maxAutoDiscountPct: number;
  qaGenerationEnabled: boolean;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DEFAULT_HOURS: BusinessHours = { days: [1, 2, 3, 4, 5], open: "07:00", close: "17:00" };

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [f, setF] = useState({
    ...initial,
    businessHours: initial.businessHours ?? DEFAULT_HOURS,
    adminWhatsapp: initial.adminWhatsapp ?? "",
    locationName: initial.locationName ?? "",
    locationAddress: initial.locationAddress ?? "",
    locationLat: initial.locationLat != null ? String(initial.locationLat) : "",
    locationLng: initial.locationLng != null ? String(initial.locationLng) : "",
    locationMapsUrl: initial.locationMapsUrl ?? "",
  });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleDay = (d: number) =>
    set("businessHours", {
      ...f.businessHours,
      days: f.businessHours.days.includes(d)
        ? f.businessHours.days.filter((x) => x !== d)
        : [...f.businessHours.days, d].sort(),
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/panel/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          botName: f.botName,
          tonePrompt: f.tonePrompt,
          welcomeMessage: f.welcomeMessage,
          afterHoursMessage: f.afterHoursMessage,
          businessHours: f.businessHours,
          channelsEnabled: f.channelsEnabled,
          adminWhatsapp: f.adminWhatsapp,
          locationName: f.locationName,
          locationAddress: f.locationAddress,
          locationLat: f.locationLat === "" ? null : Number(f.locationLat),
          locationLng: f.locationLng === "" ? null : Number(f.locationLng),
          locationMapsUrl: f.locationMapsUrl,
          retentionMonths: f.retentionMonths,
          maxAutoDiscountPct: f.maxAutoDiscountPct,
          qaGenerationEnabled: f.qaGenerationEnabled,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Error al guardar");
      toast.success("Cambios guardados.");
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Identidad */}
      <Card title="Identidad y tono">
        <Field label="Nombre del bot">
          <input className={inputCls} value={f.botName} onChange={(e) => set("botName", e.target.value)} />
        </Field>
        <Field label="Tono (instrucciones de estilo)">
          <textarea rows={3} className={inputCls} value={f.tonePrompt} onChange={(e) => set("tonePrompt", e.target.value)} />
        </Field>
        <Field label="Mensaje de bienvenida">
          <textarea rows={2} className={inputCls} value={f.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} />
        </Field>
        <Field label="Mensaje fuera de horario">
          <textarea rows={2} className={inputCls} value={f.afterHoursMessage} onChange={(e) => set("afterHoursMessage", e.target.value)} />
        </Field>
      </Card>

      {/* Horarios */}
      <Card title="Horario de atención">
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                f.businessHours.days.includes(i)
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:bg-accent/70",
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Apertura">
            <input type="time" className={inputCls} value={f.businessHours.open} onChange={(e) => set("businessHours", { ...f.businessHours, open: e.target.value })} />
          </Field>
          <Field label="Cierre">
            <input type="time" className={inputCls} value={f.businessHours.close} onChange={(e) => set("businessHours", { ...f.businessHours, close: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Canales */}
      <Card title="Canales habilitados">
        <div className="space-y-2">
          {(["messenger", "whatsapp", "instagram"] as const).map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm capitalize text-foreground">
              <input
                type="checkbox"
                checked={f.channelsEnabled[ch]}
                onChange={(e) => set("channelsEnabled", { ...f.channelsEnabled, [ch]: e.target.checked })}
              />
              {ch}
            </label>
          ))}
        </div>
      </Card>

      {/* Ubicación */}
      <Card title="Ubicación de la sede (tarjeta de mapa)">
        <p className="-mt-1 text-xs text-muted-foreground">
          El bot envía una tarjeta de ubicación cuando preguntan dónde están: en WhatsApp es un mapa
          nativo; en Messenger/Instagram una tarjeta con botón &quot;Abrir en Maps&quot; (y mapa si
          configuraste GOOGLE_MAPS_API_KEY en Vercel). Las coordenadas las sacas de Google Maps
          (clic derecho sobre el punto → copia los números).
        </p>
        <Field label="Nombre del lugar">
          <input className={inputCls} placeholder="CI Quality Group — Mamonal" value={f.locationName} onChange={(e) => set("locationName", e.target.value)} />
        </Field>
        <Field label="Dirección">
          <input className={inputCls} placeholder="Kra 67 #9-315, vía Arroz Barato, Cartagena" value={f.locationAddress} onChange={(e) => set("locationAddress", e.target.value)} />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Field label="Latitud">
            <input className={inputCls} placeholder="10.3245" value={f.locationLat} onChange={(e) => set("locationLat", e.target.value)} />
          </Field>
          <Field label="Longitud">
            <input className={inputCls} placeholder="-75.5012" value={f.locationLng} onChange={(e) => set("locationLng", e.target.value)} />
          </Field>
        </div>
        <Field label="Enlace de Google Maps (opcional; si lo dejas vacío se genera de lat/lng)">
          <input className={inputCls} placeholder="https://maps.app.goo.gl/..." value={f.locationMapsUrl} onChange={(e) => set("locationMapsUrl", e.target.value)} />
        </Field>
      </Card>

      {/* Operación / privacidad */}
      <Card title="Operación y privacidad">
        <Field label="WhatsApp del administrador (avisos de leads/relevos)">
          <input className={inputCls} placeholder="57300..." value={f.adminWhatsapp} onChange={(e) => set("adminWhatsapp", e.target.value)} />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Descuento máximo automático (%)">
            <input type="number" min={0} max={100} className={inputCls} value={f.maxAutoDiscountPct} onChange={(e) => set("maxAutoDiscountPct", Number(e.target.value))} />
          </Field>
          <Field label="Retención de datos (meses · Ley 1581)">
            <input type="number" min={1} max={120} className={inputCls} value={f.retentionMonths} onChange={(e) => set("retentionMonths", Number(e.target.value))} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Las conversaciones más viejas que la retención se borran automáticamente cada noche.{" "}
          <a href="/privacidad" target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Ver aviso de privacidad
          </a>
          .
        </p>
      </Card>

      {/* Conocimiento */}
      <Card title="Conocimiento">
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={f.qaGenerationEnabled}
            onChange={(e) => set("qaGenerationEnabled", e.target.checked)}
          />
          <span>
            Generar preguntas frecuentes al subir documentos
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Al ingerir un documento, analiza su contenido y extrae las preguntas que permite
              responder (con gpt-4o-mini, ~½ centavo por documento). Mejora la búsqueda y deja ver el
              valor de cada fuente. Desactívalo para no usar la API en la ingesta.
            </span>
          </span>
        </label>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
