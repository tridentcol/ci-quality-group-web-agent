"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, isActive } from "@/components/panel/nav-items";
import { CommandTrigger } from "@/components/panel/command-menu";

const STORAGE_KEY = "sidebar-collapsed";

// Sidebar persistente de escritorio. Colapsable a un riel de iconos para ganar
// espacio en pantallas grandes; la preferencia se recuerda en localStorage.
// En móvil/tablet se oculta y la navegación la cubre <MobileNav /> (top bar + drawer).
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Encabezado: marca + botón de colapso */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-0" : "gap-2 px-5",
        )}
      >
        {!collapsed && (
          <>
            <span className="size-2.5 rounded-full bg-primary" aria-hidden />
            <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">
              CI Quality Group
            </span>
          </>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <CommandTrigger className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm" />
        </div>
      )}

      <nav className={cn("flex-1 space-y-1 py-3", collapsed ? "px-2" : "px-3")}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "flex items-center border-t border-sidebar-border p-4",
          collapsed ? "justify-center" : "gap-3",
        )}
      >
        <UserButton />
        {!collapsed && <span className="text-xs text-muted-foreground">Sesión de administrador</span>}
      </div>
    </aside>
  );
}
