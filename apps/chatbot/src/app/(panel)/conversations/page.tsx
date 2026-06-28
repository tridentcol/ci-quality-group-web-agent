import { ConversationsList } from "./conversations-list";
import { listConversations } from "@/lib/data/panel";

export default async function ConversationsPage() {
  const initial = await listConversations();
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Conversaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hilos de los 3 canales. Entra a una para ver el historial y tomar o liberar el control.
        </p>
      </header>
      <ConversationsList initial={initial} />
    </div>
  );
}
