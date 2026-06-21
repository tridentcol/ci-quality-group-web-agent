import { Playground } from "./playground";

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Probar el bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversa como si fueras un cliente —con memoria entre turnos— y mira en cada respuesta qué
          conocimiento recupera (con su score) y qué herramientas usa. No crea leads ni huecos: es
          solo prueba.
        </p>
      </header>
      <Playground />
    </div>
  );
}
