import { PlaygroundTabs } from "./playground-tabs";

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Probar y depurar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chatea con el bot, inspecciona qué conocimiento recupera, mira el prompt real que arma y
          corre escenarios de prueba. Todo sin crear leads ni huecos reales.
        </p>
      </header>
      <PlaygroundTabs />
    </div>
  );
}
