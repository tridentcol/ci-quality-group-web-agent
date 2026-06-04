import { ConversationsList } from "./conversations-list";

export default function ConversationsPage() {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Conversaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hilos de los 3 canales. Entra a una para ver el historial y tomar o liberar el control.
        </p>
      </header>
      <ConversationsList />
    </div>
  );
}
