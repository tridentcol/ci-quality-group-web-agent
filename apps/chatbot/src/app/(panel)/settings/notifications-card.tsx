"use client";

import { useState } from "react";
import { Loader2, Check, X, Send, Wand2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NotifValue {
  email: { enabled: boolean; to: string; resendKey: string; from: string };
  telegram: { enabled: boolean; token: string; chatId: string };
  whatsapp: { enabled: boolean };
}

type Channel = keyof NotifValue;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function NotificationsCard({
  value,
  onChange,
}: {
  value: NotifValue;
  onChange: <C extends Channel>(channel: C, patch: Partial<NotifValue[C]>) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Notificaciones de leads y relevos</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Cada lead o relevo se avisa por TODOS los canales activos, con enlace directo a la
        conversación. Activa uno y sigue su guía paso a paso. Si un envío falla, lo verás en Salud.
      </p>
      <div className="space-y-3">
        <TelegramChannel value={value.telegram} onChange={(p) => onChange("telegram", p)} />
        <EmailChannel value={value.email} onChange={(p) => onChange("email", p)} />
        <WhatsappChannel value={value.whatsapp} onChange={(p) => onChange("whatsapp", p)} />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ChannelShell({
  title,
  badge,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-3 transition-colors", enabled ? "border-primary/40 bg-primary/5" : "border-border")}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          onClick={() => onToggle(!enabled)}
          className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", enabled ? "bg-primary" : "bg-input")}
        >
          <span className={cn("inline-block size-4 transform rounded-full bg-white transition-transform", enabled ? "translate-x-4" : "translate-x-0.5")} />
        </button>
        <span className="text-sm font-medium text-foreground">{title}</span>
        {badge && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">{badge}</span>}
      </div>
      {enabled && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

// Paso numerado de la guía.
function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
      {children} <ExternalLink className="size-3" />
    </a>
  );
}

// Botón "Enviar prueba" reutilizable: muestra resultado inline.
function TestButton({ run, disabled }: { run: () => Promise<{ ok: boolean; error?: string }>; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setState("busy");
    const r = await run();
    if (r.ok) {
      setState("ok");
      setMsg("¡Enviada! Revisa que te haya llegado.");
    } else {
      setState("err");
      setMsg(r.error ?? "No se pudo enviar.");
    }
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={go}
        disabled={disabled || state === "busy"}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
      >
        {state === "busy" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        Enviar prueba
      </button>
      {state === "ok" && <p className="flex items-center gap-1 text-xs text-success"><Check className="size-3.5" /> {msg}</p>}
      {state === "err" && <p className="flex items-center gap-1 text-xs text-destructive"><X className="size-3.5" /> {msg}</p>}
    </div>
  );
}

// ── Telegram ─────────────────────────────────────────────────────────────────
function TelegramChannel({ value, onChange }: { value: NotifValue["telegram"]; onChange: (p: Partial<NotifValue["telegram"]>) => void }) {
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function detect() {
    setDetecting(true);
    setDetectMsg(null);
    try {
      const res = await fetch("/api/panel/notifications/telegram-detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: value.token }),
      });
      const json = await res.json();
      if (json.success) {
        onChange({ chatId: json.data.chatId });
        setDetectMsg({ ok: true, text: `Detectado: ${json.data.name} (${json.data.chatId})` });
      } else {
        setDetectMsg({ ok: false, text: json.error?.message ?? "No se pudo detectar." });
      }
    } finally {
      setDetecting(false);
    }
  }

  async function test() {
    const res = await fetch("/api/panel/notifications/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "telegram", config: { telegram: { token: value.token, chatId: value.chatId } } }),
    });
    const json = await res.json();
    return { ok: !!json.success, error: json.error?.message };
  }

  return (
    <ChannelShell title="Telegram" badge="Recomendado" enabled={value.enabled} onToggle={(v) => onChange({ enabled: v })}>
      <Step n={1} title="Crea tu bot">
        <p className="text-xs text-muted-foreground">
          Abre <ExtLink href="https://t.me/BotFather">@BotFather</ExtLink> en Telegram, envía <code className="rounded bg-accent px-1">/newbot</code>, ponle nombre y copia el <b>token</b> que te da.
        </p>
        <input className={inputCls} placeholder="Token del bot (123456:ABC-...)" value={value.token} onChange={(e) => onChange({ token: e.target.value })} />
      </Step>
      <Step n={2} title="Conecta tu chat">
        <p className="text-xs text-muted-foreground">
          Abre tu bot y envíale cualquier mensaje (ej. &quot;hola&quot;). Luego pulsa Detectar y traemos tu chat id solo.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={detect} disabled={!value.token.trim() || detecting} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {detecting ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Detectar mi chat id
          </button>
          <input className={cn(inputCls, "max-w-[12rem]")} placeholder="Chat id" value={value.chatId} onChange={(e) => onChange({ chatId: e.target.value })} />
        </div>
        {detectMsg && <p className={cn("text-xs", detectMsg.ok ? "text-success" : "text-destructive")}>{detectMsg.text}</p>}
      </Step>
      <Step n={3} title="Prueba">
        <TestButton run={test} disabled={!value.token.trim() || !value.chatId.trim()} />
      </Step>
    </ChannelShell>
  );
}

// ── Email ────────────────────────────────────────────────────────────────────
function EmailChannel({ value, onChange }: { value: NotifValue["email"]; onChange: (p: Partial<NotifValue["email"]>) => void }) {
  async function test() {
    const res = await fetch("/api/panel/notifications/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "email", config: { email: { to: value.to, resendKey: value.resendKey, from: value.from } } }),
    });
    const json = await res.json();
    return { ok: !!json.success, error: json.error?.message };
  }
  return (
    <ChannelShell title="Email" enabled={value.enabled} onToggle={(v) => onChange({ enabled: v })}>
      <Step n={1} title="Crea una cuenta de envío">
        <p className="text-xs text-muted-foreground">
          Regístrate en <ExtLink href="https://resend.com">Resend</ExtLink> (capa gratuita), ve a <b>API Keys</b> y crea una. Pégala aquí.
        </p>
        <input className={inputCls} placeholder="Resend API key (re_...)" value={value.resendKey} onChange={(e) => onChange({ resendKey: e.target.value })} />
      </Step>
      <Step n={2} title="¿A qué correo te avisamos?">
        <input className={inputCls} placeholder="tu-correo@ejemplo.com" value={value.to} onChange={(e) => onChange({ to: e.target.value })} />
        <p className="text-xs text-muted-foreground">
          Para enviar a cualquier correo debes verificar un dominio en Resend. Sin dominio, solo llega
          al correo de tu propia cuenta de Resend (suficiente para empezar).
        </p>
      </Step>
      <Step n={3} title="Remitente (opcional)">
        <input className={inputCls} placeholder="Avisos CQG <avisos@tudominio.com>" value={value.from} onChange={(e) => onChange({ from: e.target.value })} />
      </Step>
      <Step n={4} title="Prueba">
        <TestButton run={test} disabled={!value.resendKey.trim() || !value.to.trim()} />
      </Step>
    </ChannelShell>
  );
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────
function WhatsappChannel({ value, onChange }: { value: NotifValue["whatsapp"]; onChange: (p: Partial<NotifValue["whatsapp"]>) => void }) {
  async function test() {
    const res = await fetch("/api/panel/notifications/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "whatsapp", config: {} }),
    });
    const json = await res.json();
    return { ok: !!json.success, error: json.error?.message };
  }
  return (
    <ChannelShell title="WhatsApp" enabled={value.enabled} onToggle={(v) => onChange({ enabled: v })}>
      <Step n={1} title="Conecta WhatsApp Cloud API">
        <p className="text-xs text-muted-foreground">
          Requiere el canal de WhatsApp conectado (como Messenger) con sus credenciales en el servidor.
          Avísame si quieres conectarlo y te guío.
        </p>
      </Step>
      <Step n={2} title="Número del administrador">
        <p className="text-xs text-muted-foreground">
          Usa el número configurado arriba (en &quot;Operación y privacidad&quot;).
        </p>
      </Step>
      <Step n={3} title="Ojo: ventana de 24 h">
        <p className="text-xs text-muted-foreground">
          WhatsApp solo permite mensajes libres dentro de 24 h tras escribirle al número, o con una
          plantilla aprobada. Por eso Telegram o Email son más confiables para estos avisos.
        </p>
      </Step>
      <Step n={4} title="Prueba">
        <TestButton run={test} />
      </Step>
    </ChannelShell>
  );
}
