"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  BookOpen,
  Tags,
  Users,
  HelpCircle,
  MessagesSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/knowledge", label: "Conocimiento", icon: BookOpen },
  { href: "/pricing", label: "Precios", icon: Tags },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/gaps", label: "Huecos", icon: HelpCircle },
  { href: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <span className="size-2.5 rounded-full bg-primary" aria-hidden />
        <span className="text-sm font-semibold text-sidebar-foreground">
          CI Quality Group
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
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
