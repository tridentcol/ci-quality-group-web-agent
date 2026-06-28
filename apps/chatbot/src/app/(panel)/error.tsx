"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Red de seguridad de la UI del panel: si una página o componente lanza, en vez de
 * una pantalla rota se muestra este aviso con opción de reintentar. (Next.js usa el
 * error.tsx más cercano para envolver el segmento.)
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Panel error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Algo salió mal</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ocurrió un error al cargar esta sección. Puedes reintentar; si persiste, recarga la
          página o vuelve al panel.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RotateCw className="size-4" /> Reintentar
      </button>
    </div>
  );
}
