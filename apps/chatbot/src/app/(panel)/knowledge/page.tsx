import { KnowledgeManager } from "./knowledge-manager";
import { listKnowledgeSources } from "@/lib/data/panel";

export default async function KnowledgePage() {
  const initial = await listKnowledgeSources();
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Conocimiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube documentos, enlaces o texto. El bot solo responde con esta información verificada.
        </p>
      </header>
      <KnowledgeManager initial={initial} />
    </div>
  );
}
