import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const user = await currentUser();
  const name = user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "admin";

  const KPIS = [
    { label: "Conversaciones", hint: "3 canales" },
    { label: "Leads nuevos", hint: "pendientes de contacto" },
    { label: "Relevos", hint: "esperando humano" },
    { label: "Huecos abiertos", hint: "por resolver" },
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola, {name}. Las métricas se conectarán en el Step 12.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">—</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
