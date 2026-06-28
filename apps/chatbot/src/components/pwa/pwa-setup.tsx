"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Registra el service worker (habilita PWA/offline) y ofrece un botón "Instalar app"
 * cuando el navegador lo permite (evento beforeinstallprompt). En iOS no existe ese
 * evento: se muestra una pista para "Compartir → Agregar a inicio".
 */
export function PwaSetup() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS: no hay beforeinstallprompt → mostrar pista solo en Safari iOS.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
    if (isIos && isSafari) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (dismissed) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm rounded-xl border border-border bg-card p-3 shadow-lg sm:left-auto sm:right-4">
      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">CI</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Instala el panel como app</p>
          {deferred ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">Acceso directo y pantalla completa, como una app nativa.</p>
              <button
                onClick={install}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="size-3.5" /> Instalar app
              </button>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              En iPhone: toca <b>Compartir</b> y luego <b>Agregar a inicio</b>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
