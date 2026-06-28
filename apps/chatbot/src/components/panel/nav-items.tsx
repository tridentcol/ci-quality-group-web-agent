import {
  LayoutDashboard,
  BookOpen,
  MessageCircleQuestion,
  Image,
  FlaskConical,
  Tags,
  Users,
  Contact,
  FileText,
  HelpCircle,
  MessagesSquare,
  Activity,
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
  { href: "/faqs", label: "FAQs rápidas", icon: MessageCircleQuestion },
  { href: "/images", label: "Medios", icon: Image },
  { href: "/playground", label: "Probar", icon: FlaskConical },
  { href: "/pricing", label: "Precios", icon: Tags },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/clientes", label: "Clientes", icon: Contact },
  { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/gaps", label: "Huecos", icon: HelpCircle },
  { href: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { href: "/health", label: "Salud", icon: Activity },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

// ¿Está activa la ruta href dado el pathname actual?
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
