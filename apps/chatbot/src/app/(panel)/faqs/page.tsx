import { SourceQaList } from "../knowledge/source-qa-list";
import { ensureFaqSource, listSourceQa } from "@/lib/data/panel";

export default async function FaqsPage() {
  // Server-side: asegura la fuente "manual" y trae sus preguntas ya listas (sin skeleton).
  const sourceId = await ensureFaqSource();
  const initial = await listSourceQa(sourceId);
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">FAQs rápidas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Respuestas a preguntas comunes, sin subir documentos. El bot las usa al instante y
          puedes adjuntarles una imagen o video.
        </p>
      </header>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <SourceQaList sourceId={sourceId} initial={initial} />
      </div>
    </div>
  );
}
