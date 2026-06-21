"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { NAV } from "@/components/panel/nav-items";

/**
 * Paleta de comandos (Cmd/Ctrl+K): saltar a cualquier sección del panel desde el
 * teclado. cmdk aporta el combobox accesible (flechas, filtrado, aria-selected) y
 * Radix Dialog el modal accesible (trampa de foco, Escape, retorno de foco).
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
          aria-label="Comandos"
        >
          <Dialog.Title className="sr-only">Comandos</Dialog.Title>
          <Command className="[&_[cmdk-input]]:outline-none">
            <Command.Input
              placeholder="Buscar sección o acción…"
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                Sin resultados.
              </Command.Empty>
              <Command.Group
                heading="Ir a"
                className="text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Command.Item
                    key={href}
                    value={label}
                    onSelect={() => go(href)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Botón disparador de la paleta (muestra el atajo). */
export function CommandTrigger({ className }: { className?: string }) {
  // Despacha el mismo atajo para abrir la paleta sin acoplar estado.
  const open = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };
  return (
    <button
      type="button"
      onClick={open}
      className={className}
      aria-label="Abrir paleta de comandos (Cmd-K)"
    >
      <span className="text-muted-foreground">Buscar…</span>
      <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
