"use client";

import { useState } from "react";
import { Loader2, Check, Plus, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeHours } from "@/lib/ai/hours";

export interface DayHours {
  open: string;
  close: string;
}
export interface BusinessHours {
  schedule: (DayHours | null)[];
  holidays?: string[];
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
  businessHours: unknown; // jsonb crudo (forma nueva o antigua) → se normaliza en el form
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

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WD: DayHours = { open: "07:00", close: "17:00" };
const DEFAULT_HOURS: BusinessHours = { schedule: [null, WD, WD, WD, WD, WD, null], holidays: [] };

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [f, setF] = useState({
    ...initial,
    businessHours: normalizeHours(initial.businessHours) ?? DEFAULT_HOURS,
    adminWhatsapp: initial.adminWhatsapp ?? "",
    locationName: initial.locationName ?? "",
    locationAddress: initial.locationAddress ?? "",
    locationLat: initial.locationLat != null ? String(initial.locationLat) : "",
    locationLng: initial.locationLng != null ? String(initial.locationLng) : "",
    locationMapsUrl: initial.locationMapsUrl ?? "",
  });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Helpers de horario por día + feriados.
  const hours = f.businessHours;
  const setDay = (i: number, v: DayHours | null) =>
    set("businessHours", { ...hours, schedule: hours.schedule.map((s, idx) => (idx === i ? v : s)) });
  const toggleOpen = (i: number) => setDay(i, hours.schedule[i] ? null : { open: "08:00", close: "18:00" });
  const setHolidays = (h: string[]) => set("businessHours", { ...hours, holidays: h });
  const [holidayInput, setHolidayInput] = useState("");

  // Datos para la vista previa del mapa (OpenStreetMap, sin clave).
  const lat = Number(f.locationLat);
  const lng = Number(f.locationLng);
  const hasLoc = f.locationLat !== "" && f.locationLng !== "" && !Number.isNaN(lat) && !Number.isNaN(lng);
  const osmSrc = hasLoc
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.008}%2C${lng + 0.01}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`
    : "";

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

      {/* Horarios por día + feriados */}
      <Card title="Horario de atención">
        <p className="-mt-1 text-xs text-muted-foreground">
          Define el horario de cada día (zona Colombia). Fuera de él, o en feriados, el bot sigue
          respondiendo pero envía el mensaje de &quot;fuera de horario&quot;.
        </p>
        <div className="space-y-2">
          {DAYS.map((label, i) => {
            const d = hours.schedule[i];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!d}
                  aria-label={`${label} ${d ? "abierto" : "cerrado"}`}
                  onClick={() => toggleOpen(i)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                    d ? "bg-primary" : "bg-input",
                  )}
                >
                  <span className={cn("inline-block size-4 transform rounded-full bg-white transition-transform", d ? "translate-x-4" : "translate-x-0.5")} />
                </button>
                <span className="w-24 text-sm text-foreground">{label}</span>
                {d ? (
                  <>
                    <input type="time" aria-label={`Apertura ${label}`} className={cn(inputCls, "w-auto")} value={d.open} onChange={(e) => setDay(i, { ...d, open: e.target.value })} />
                    <span className="text-muted-foreground">a</span>
                    <input type="time" aria-label={`Cierre ${label}`} className={cn(inputCls, "w-auto")} value={d.close} onChange={(e) => setDay(i, { ...d, close: e.target.value })} />
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Feriados (días cerrados)</span>
          <div className="flex flex-wrap gap-2">
            {(hours.holidays ?? []).map((h) => (
              <span key={h} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-foreground">
                {h}
                <button type="button" aria-label={`Quitar feriado ${h}`} onClick={() => setHolidays((hours.holidays ?? []).filter((x) => x !== h))} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input type="date" aria-label="Nueva fecha de feriado" className={cn(inputCls, "w-auto")} value={holidayInput} onChange={(e) => setHolidayInput(e.target.value)} />
            <button
              type="button"
              onClick={() => {
                const v = holidayInput.trim();
                if (v && !(hours.holidays ?? []).includes(v)) setHolidays([...(hours.holidays ?? []), v].sort());
                setHolidayInput("");
              }}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> Agregar feriado
            </button>
          </div>
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

      {/* Vista previa */}
      <Card title="Vista previa">
        <p className="-mt-1 text-xs text-muted-foreground">
          Así se verán los mensajes y la ubicación que envía el bot (el mapa de Messenger usa Google;
          este previo usa OpenStreetMap, solo para confirmar el punto).
        </p>
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          {f.welcomeMessage.trim() ? (
            <PreviewBubble label="Bienvenida">{f.welcomeMessage}</PreviewBubble>
          ) : (
            <p className="text-xs text-muted-foreground">Sin mensaje de bienvenida.</p>
          )}
          {f.afterHoursMessage.trim() && (
            <PreviewBubble label="Fuera de horario">{f.afterHoursMessage}</PreviewBubble>
          )}
        </div>
        <div className="mt-3">
          <span className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" /> Ubicación {f.locationName ? `· ${f.locationName}` : ""}
          </span>
          {hasLoc ? (
            <iframe
              title="Vista previa de la ubicación"
              className="h-56 w-full rounded-lg border border-border"
              src={osmSrc}
              loading="lazy"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Pon Latitud y Longitud arriba para ver el mapa.
            </p>
          )}
        </div>
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

// Burbuja de chat para la vista previa de mensajes.
function PreviewBubble({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
        <div className="mb-0.5 text-xs opacity-70">{label}</div>
        <div className="whitespace-pre-wrap">{children}</div>
      </div>
    </div>
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
