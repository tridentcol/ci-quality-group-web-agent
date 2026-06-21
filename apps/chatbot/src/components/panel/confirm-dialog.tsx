"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Diálogo de confirmación accesible (Radix AlertDialog) que reemplaza al
 * window.confirm nativo: trampa de foco, Escape, roles ARIA y estética de marca.
 * Uso: `const confirm = useConfirm(); if (!(await confirm({...}))) return;`
 */
interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    setOpen(false);
    resolver.current?.(value);
    resolver.current = null;
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(o) => !o && settle(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-xl">
            <AlertDialog.Title className="text-base font-semibold text-foreground">
              {opts.title ?? "¿Confirmar?"}
            </AlertDialog.Title>
            {opts.description && (
              <AlertDialog.Description className="mt-1.5 text-sm text-muted-foreground">
                {opts.description}
              </AlertDialog.Description>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent">
                {opts.cancelLabel ?? "Cancelar"}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => settle(true)}
                className={cn(
                  "inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
                  opts.destructive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90",
                )}
              >
                {opts.confirmLabel ?? "Confirmar"}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmCtx.Provider>
  );
}
