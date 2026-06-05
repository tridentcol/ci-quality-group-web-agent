import { Playground } from "./playground";

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Probar el bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Haz una pregunta como si fueras un cliente y mira qué responde, qué conocimiento recupera
          y qué herramientas usa. No crea leads ni huecos: es solo prueba.
        </p>
      </header>
      <Playground />
    </div>
  );
}
