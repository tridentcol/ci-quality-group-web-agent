"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Hand, Bot, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelBadge, ConversationStatusBadge } from "@/components/panel/channel-badge";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string | null;
}
interface Conversation {
  id: string;
  channel: string;
  customerName: string | null;
  status: string;
}

export function ConversationView({ id }: { id: string }) {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/panel/conversations?id=${id}`);
    const json = await res.json();
    if (json.success) {
      setConv(json.data.conversation);
      setMessages(json.data.messages);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (loading) return <p className="p-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (!conv) return <p className="p-8 text-center text-sm text-muted-foreground">Conversación no encontrada.</p>;

  return (
    <div className="mx-auto max-w-3xl p-8">
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
  const fromCustomer = message.role === "user";
  if (message.role === "system") {
    return <p className="text-center text-xs text-muted-foreground">{message.content}</p>;
  }
  const who = message.role === "human_agent" ? "Agente" : message.role === "assistant" ? "Bot" : null;
  return (
    <div className={cn("flex", fromCustomer ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
          fromCustomer ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {who && <div className="mb-0.5 text-xs opacity-70">{who}</div>}
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
