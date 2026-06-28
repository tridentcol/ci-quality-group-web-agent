import { FaqsManager } from "./faqs-manager";

export default function FaqsPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">FAQs rápidas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Respuestas a preguntas comunes, sin subir documentos. El bot las usa al instante y
          puedes adjuntarles una imagen o video.
        </p>
      </header>
      <FaqsManager />
    </div>
  );
}
