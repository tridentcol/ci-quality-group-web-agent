"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Hand, Bot, XCircle, Trash2, Info, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChannelBadge, ConversationStatusBadge } from "@/components/panel/channel-badge";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { MediaPicker } from "@/components/panel/media-picker";

const META_CHANNELS = ["messenger", "whatsapp", "instagram"];

interface MessageMeta {
  model?: string;
  routerReason?: string;
  contextUsed?: boolean;
  topScores?: number[];
  tools?: string[];
}
interface Message {
  id: string;
  role: string;
  content: string;
  metadata?: MessageMeta | null;
  createdAt: string | null;
}
interface Conversation {
  id: string;
  channel: string;
  customerName: string | null;
  status: string;
  customerId: string | null;
}

export function ConversationView({
  id,
  initial,
}: {
  id: string;
  initial: { conversation: Conversation; messages: Message[] };
}) {
  const [conv, setConv] = useState<Conversation | null>(initial.conversation);
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/panel/conversations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (json.success) setConv((c) => (c ? { ...c, status: json.data.status } : c));
    } finally {
      setBusy(false);
    }
  }

  async function erase(scope: "conversation" | "customer") {
    const opts =
      scope === "customer"
        ? { title: "¿Borrar el cliente y TODO su historial?", description: "Habeas Data (Ley 1581). Irreversible." }
        : { title: "¿Borrar esta conversación?", description: "Se eliminan sus mensajes. Irreversible." };
    if (!(await confirm({ ...opts, confirmLabel: "Borrar", destructive: true }))) return;
    setBusy(true);
    try {
      const qs = scope === "customer" ? `?id=${id}&erase=customer` : `?id=${id}`;
      const res = await fetch(`/api/panel/conversations${qs}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) router.push("/conversations");
    } finally {
      setBusy(false);
    }
  }

  if (!conv) return <p className="p-8 text-center text-sm text-muted-foreground">Conversación no encontrada.</p>;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Link href="/conversations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Conversaciones
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <ChannelBadge channel={conv.channel} />
          <span className="font-medium text-foreground">{conv.customerName ?? "Cliente"}</span>
          <ConversationStatusBadge status={conv.status} />
        </div>
        <div className="flex items-center gap-2">
          {conv.status === "human_controlled" ? (
            <ToggleBtn onClick={() => setStatus("bot_active")} busy={busy} icon={Bot}>
              Liberar al bot
            </ToggleBtn>
          ) : (
            <ToggleBtn onClick={() => setStatus("human_controlled")} busy={busy} icon={Hand}>
              Tomar control
            </ToggleBtn>
          )}
          {conv.status !== "closed" && (
            <ToggleBtn onClick={() => setStatus("closed")} busy={busy} icon={XCircle} variant="ghost">
              Cerrar
            </ToggleBtn>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Sin mensajes.</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}
      </div>

      {META_CHANNELS.includes(conv.channel) && conv.status !== "closed" && (
        <ReplyBox
          id={id}
          paused={conv.status === "human_controlled"}
          onSent={(sent) => {
            setMessages((prev) => [...prev, ...sent]);
            setConv((c) => (c ? { ...c, status: "human_controlled" } : c));
          }}
        />
      )}

      <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-foreground">Privacidad (Habeas Data · Ley 1581)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Borrado de datos bajo solicitud del titular. Irreversible.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => erase("conversation")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            <Trash2 className="size-4" /> Borrar conversación
          </button>
          {conv.customerId && (
            <button
              onClick={() => erase("customer")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
            >
              <Trash2 className="size-4" /> Borrar cliente y todo su historial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Cuadro para responder COMO AGENTE HUMANO desde el panel. Envía por el canal del
// cliente, registra el mensaje y deja la conversación en pausa (human_controlled).
function ReplyBox({
  id,
  paused,
  onSent,
}: {
  id: string;
  paused: boolean;
  onSent: (messages: Message[]) => void;
}) {
  const [text, setText] = useState("");
  const [imageId, setImageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSend = (text.trim().length > 0 || !!imageId) && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      const res = await fetch("/api/panel/conversations/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          text: text.trim() || undefined,
          imageId: imageId || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onSent(json.data.messages as Message[]);
        setText("");
        setImageId(null);
        toast.success("Mensaje enviado al cliente.");
      } else {
        toast.error(json.error?.message ?? "No se pudo enviar.");
      }
    } catch {
      toast.error("No se pudo enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">Responder como agente</span>
        <span className="text-xs text-muted-foreground">
          {paused ? "Tú tienes el control (bot en pausa)" : "Al enviar, el bot queda en pausa"}
        </span>
      </div>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        placeholder="Escribe tu respuesta al cliente…"
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <MediaPicker value={imageId} onChange={setImageId} />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">⌘/Ctrl + Enter</span>
          <button
            onClick={send}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({
  onClick,
  busy,
  icon: Icon,
  children,
  variant = "solid",
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof Hand;
  children: React.ReactNode;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
        variant === "solid"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "text-muted-foreground hover:bg-accent",
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {children}
    </button>
  );
}

function Bubble({ message }: { message: Message }) {
  const [showMeta, setShowMeta] = useState(false);
  const fromCustomer = message.role === "user";
  if (message.role === "system") {
    return <p className="text-center text-xs text-muted-foreground">{message.content}</p>;
  }
  const who = message.role === "human_agent" ? "Agente" : message.role === "assistant" ? "Bot" : null;
  const meta = message.role === "assistant" ? message.metadata ?? null : null;
  const hasMeta = !!meta && Object.keys(meta).length > 0;

  return (
    <div className={cn("flex flex-col", fromCustomer ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm sm:max-w-[75%]",
          fromCustomer ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {who && <div className="mb-0.5 text-xs opacity-70">{who}</div>}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>

      {hasMeta && (
        <button
          onClick={() => setShowMeta((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="size-3" /> {showMeta ? "ocultar" : "por qué respondió esto"}
        </button>
      )}
      {hasMeta && showMeta && meta && (
        <div className="mt-1 max-w-[85%] rounded-lg border border-border bg-card p-2 text-xs text-muted-foreground sm:max-w-[75%]">
          <div>
            <span className="font-medium text-foreground">Modelo:</span> {meta.model ?? "—"}
          </div>
          <div>
            <span className="font-medium text-foreground">Contexto:</span>{" "}
            {meta.contextUsed ? "sí" : "no"}
            {meta.topScores?.length ? ` (scores: ${meta.topScores.join(", ")})` : ""}
          </div>
          {meta.tools?.length ? (
            <div>
              <span className="font-medium text-foreground">Tools:</span> {meta.tools.join(", ")}
            </div>
          ) : null}
          {meta.routerReason ? (
            <div>
              <span className="font-medium text-foreground">Router:</span> {meta.routerReason}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
