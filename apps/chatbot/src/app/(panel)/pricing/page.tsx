import { PricingManager } from "./pricing-manager";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Precios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tabla de materiales en COP. El bot solo cotiza materiales activos con estos precios; nunca los inventa.
        </p>
      </header>
      <PricingManager />
    </div>
  );
}
