// Límite de carga del panel (Next App Router). Sin esto, cada navegación entre
// secciones esperaba a que el servidor renderizara la página completa (auth + BD)
// antes de cambiar nada → la página vieja quedaba congelada y se sentía lenta.
// Con este esqueleto, el cambio de sección es instantáneo (feedback inmediato) y
// Next puede prefetch las rutas. El sidebar/topbar del layout permanece visible.
export default function PanelLoading() {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <div className="mb-6 sm:mb-8">
        <div className="h-7 w-44 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted/70" />
      </div>

      {/* Bloque de contenido neutro */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/60 py-3 last:border-0"
          >
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
