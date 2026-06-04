import { KnowledgeManager } from "./knowledge-manager";

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Conocimiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube documentos, enlaces o texto. El bot solo responde con esta información verificada.
        </p>
      </header>
      <KnowledgeManager />
    </div>
  );
}
