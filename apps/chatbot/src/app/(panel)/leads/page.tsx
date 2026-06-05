import { LeadsManager } from "./leads-manager";

export default function LeadsPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitudes capturadas por el bot. Aprueba descuentos y actualiza el estado.
        </p>
      </header>
      <LeadsManager />
    </div>
  );
}
