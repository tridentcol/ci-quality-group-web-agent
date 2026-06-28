"use client";

import Link from "next/link";
import { ChannelBadge, ConversationStatusBadge } from "@/components/panel/channel-badge";

interface ConversationRow {
  id: string;
  channel: string;
  customerName: string | null;
  status: string;
  lastMessageAt: string | null;
  messageCount: number;
}

export function ConversationsList({ initial }: { initial: ConversationRow[] }) {
  const items = initial;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
        Aún no hay conversaciones.
      </div>
    );
  }

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("es-CO") : "—");

  return (
    <>
      {/* Cards en móvil */}
      <div className="space-y-3 md:hidden">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/conversations/${c.id}`}
            className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary"
          >
            <div className="flex items-center justify-between gap-2">
              <ChannelBadge channel={c.channel} />
              <ConversationStatusBadge status={c.status} />
            </div>
            <p className="mt-2 font-medium text-foreground">{c.customerName ?? "Cliente"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.messageCount} mensaje{c.messageCount === 1 ? "" : "s"} · {fmt(c.lastMessageAt)}
            </p>
          </Link>
        ))}
      </div>

      {/* Tabla en escritorio */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-medium">Canal</th>
              <th className="px-2 py-2 font-medium">Cliente</th>
              <th className="px-2 py-2 font-medium">Estado</th>
              <th className="px-2 py-2 font-medium">Mensajes</th>
              <th className="px-2 py-2 font-medium">Última actividad</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <ChannelBadge channel={c.channel} />
                </td>
                <td className="px-2 py-3 text-foreground">{c.customerName ?? "Cliente"}</td>
                <td className="px-2 py-3">
                  <ConversationStatusBadge status={c.status} />
                </td>
                <td className="px-2 py-3 text-muted-foreground">{c.messageCount}</td>
                <td className="px-2 py-3 text-muted-foreground">{fmt(c.lastMessageAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/conversations/${c.id}`} className="text-sm font-medium text-primary hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
