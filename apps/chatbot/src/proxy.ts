import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/*
 * Proxy (Next.js 16 renombró middleware → proxy). Auth del panel con Clerk.
 *
 * Protegido (requiere sesión admin): las páginas del panel y su API interna.
 * Público (sin Clerk): webhooks de Meta (firma HMAC propia), endpoint de Inngest
 * (firma propia), sign-in y la home.
 *
 * Regla del blueprint §8: protege (panel)/* y /api/panel/*; deja públicos los webhooks.
 */
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/knowledge(.*)',
  '/pricing(.*)',
  '/leads(.*)',
  '/gaps(.*)',
  '/conversations(.*)',
  '/settings(.*)',
  '/api/panel(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Todo menos archivos estáticos y _next
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Ruta de auto-proxy de Clerk
    '/__clerk/:path*',
    // Siempre para rutas de API (incluidos webhooks, que clerkMiddleware deja pasar)
    '/(api|trpc)(.*)',
  ],
}
