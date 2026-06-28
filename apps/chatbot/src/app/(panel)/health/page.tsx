import { HealthManager } from "./health-manager";
import { getHealth } from "@/lib/data/panel";

export default async function HealthPage() {
  const initial = await getHealth();
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Salud del bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Errores y avisos del sistema, para detectar problemas sin esperar quejas de clientes.
        </p>
      </header>
      <HealthManager initial={initial} />
    </div>
  );
}
