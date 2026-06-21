import {
  LayoutDashboard,
  BookOpen,
  Image,
  FlaskConical,
  Tags,
  Users,
  HelpCircle,
  MessagesSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Navegación del panel, compartida entre el sidebar (desktop) y el drawer (móvil).
export const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/knowledge", label: "Conocimiento", icon: BookOpen },
  { href: "/images", label: "Medios", icon: Image },
  { href: "/playground", label: "Probar", icon: FlaskConical },
  { href: "/pricing", label: "Precios", icon: Tags },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/gaps", label: "Huecos", icon: HelpCircle },
  { href: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

// ¿Está activa la ruta href dado el pathname actual?
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
