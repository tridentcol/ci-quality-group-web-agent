"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { NAV, isActive } from "@/components/panel/nav-items";
import { CommandTrigger } from "@/components/panel/command-menu";

// Sidebar persistente de escritorio. En móvil/tablet se oculta y la navegación
// la cubre <MobileNav /> (top bar + drawer).
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <span className="size-2.5 rounded-full bg-primary" aria-hidden />
        <span className="text-sm font-semibold text-sidebar-foreground">
          CI Quality Group
        </span>
      </div>

      <div className="px-3 pt-3">
        <CommandTrigger className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm" />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
  );
}
