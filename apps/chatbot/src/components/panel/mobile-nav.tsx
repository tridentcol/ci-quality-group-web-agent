"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, isActive } from "@/components/panel/nav-items";

// Navegación de móvil/tablet: top bar fija con hamburguesa + drawer deslizante.
// Se oculta en escritorio (lg+), donde manda <Sidebar />.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cerrar con Escape y bloquear el scroll del body mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Top bar */}
      <header className="pt-safe sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Menu className="size-5" />
          </button>
          <span className="size-2.5 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold text-sidebar-foreground">
            CI Quality Group
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
              )
            }
            aria-label="Buscar (paleta de comandos)"
            className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Search className="size-5" />
          </button>
          <UserButton />
        </div>
      </header>

      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        aria-hidden={!open}
        className={cn(
          "pl-safe pb-safe fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pt-safe flex min-h-14 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary" aria-hidden />
            <span className="text-sm font-semibold text-sidebar-foreground">
              CI Quality Group
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-sidebar-border p-4">
          <UserButton />
          <span className="text-xs text-muted-foreground">Sesión de administrador</span>
        </div>
      </aside>
    </div>
  );
}
