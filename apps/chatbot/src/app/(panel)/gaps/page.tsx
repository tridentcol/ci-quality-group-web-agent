import { GapsManager } from "./gaps-manager";
import { listGaps } from "@/lib/data/panel";

export default async function GapsPage() {
  const initial = await listGaps("open");
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Huecos de conocimiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preguntas que el bot no pudo responder. Al resolverlas se crea una FAQ que el bot reutiliza.
        </p>
      </header>
      <GapsManager initial={initial} />
    </div>
  );
}
