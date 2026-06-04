"use client";

import { useEffect, useState } from "react";
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

export function ConversationsList() {
  const [items, setItems] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/panel/conversations")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItems(j.data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aún no hay conversaciones.</p>
      ) : (
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
                <td className="px-2 py-3 text-muted-foreground">
                  {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString("es-CO") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/conversations/${c.id}`} className="text-sm font-medium text-primary hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
