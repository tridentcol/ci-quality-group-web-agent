import { cn } from "@/lib/utils";

const CHANNELS: Record<string, { label: string; cls: string }> = {
  messenger: { label: "Messenger", cls: "bg-blue-100 text-blue-700" },
  whatsapp: { label: "WhatsApp", cls: "bg-green-100 text-green-700" },
  instagram: { label: "Instagram", cls: "bg-pink-100 text-pink-700" },
  web: { label: "Web", cls: "bg-slate-100 text-slate-700" },
};

export function ChannelBadge({ channel }: { channel: string | null }) {
  const c = CHANNELS[channel ?? ""] ?? { label: channel ?? "—", cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", c.cls)}>
      {c.label}
    </span>
  );
}

const STATUSES: Record<string, { label: string; cls: string }> = {
  bot_active: { label: "Bot activo", cls: "bg-success/15 text-success" },
  human_controlled: { label: "Humano", cls: "bg-warning/15 text-warning" },
  closed: { label: "Cerrada", cls: "bg-muted text-muted-foreground" },
};

export function ConversationStatusBadge({ status }: { status: string }) {
  const s = STATUSES[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

// El bot no logró responder al último mensaje del cliente (falló el envío o hubo
// un error) y ya pasó un rato — nadie lo notó a simple vista antes de esto.
export function NeedsAttentionBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
      title="El bot no logró responder al último mensaje del cliente. Revisa y responde desde el panel."
    >
      Sin responder
    </span>
  );
}
