// Tokens de marca compartidos (plan maestro §6 · blueprint chatbot §7).
// Verde de marca común; la web los usa en clave cinematográfica, el panel en clave sobria.
// Única fuente de verdad para no desincronizar la marca entre las dos apps.

export const brand = {
  /** Verde reciclaje — botones, enlaces, acentos. */
  primary: '#15803D',
  /** Estado hover del primario. */
  primaryHover: '#166534',
  /** Fondo de página. */
  background: '#F8FAFC',
  /** Tarjetas, paneles, tablas. */
  surface: '#FFFFFF',
  /** Texto principal. */
  text: '#0F172A',
  /** Texto secundario, bordes suaves. */
  muted: '#64748B',
  /** Bordes, divisores. */
  border: '#E2E8F0',
  /** Errores, borrar. */
  destructive: '#DC2626',
  /** Confirmaciones, estado "ready". */
  success: '#16A34A',
  /** Relevos pendientes, leads nuevos, huecos abiertos. */
  warning: '#D97706',
} as const

export type BrandToken = keyof typeof brand
