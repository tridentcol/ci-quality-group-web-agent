# CI Quality Group — Sitio Web (apps/website)

Landing corporativa **one-page** (Astro estático) de CI Quality Group S.A.S. — empresa
industrial de Cartagena de Indias. Claim: *"Convertimos el residuo industrial en valor"*
(economía circular). Sin login, sin backend. Deploy a **Vercel** (DNS en Cloudflare).

> Regla del monorepo: se trabaja **una app a la vez**. Aquí solo `apps/website`.
> No tocar `apps/chatbot` (está en producción).

## Fuente de verdad del diseño

El diseño es **alta fidelidad / pixel-perfect** según el handoff:
`design_handoff_ci_quality_landing/README.md` (fuera de este repo). Los valores exactos
(colores, tipografía Arial, espaciados, radios, sombras, breakpoints) están en
`src/styles/globals.css` como custom properties y en los `<style>` de cada sección.

> Nota: el blueprint (`docs/ci-quality-group-website-blueprint.md`) describía una versión
> *cinematográfica oscura* con CTA a WhatsApp; **prevalece el handoff** (claro, verde
> `#3A8C2F`, CTA ancla a `#contacto`). Del blueprint se conserva solo lo técnico.

## Commands

- `pnpm --filter website dev` — servidor de desarrollo (o `pnpm dev:web` desde la raíz)
- `pnpm --filter website build` — build estático → `apps/website/dist` (o `pnpm build:web`)
- `pnpm --filter website preview` — previsualizar el build
- `pnpm --filter website check` — type-check de Astro

## Tech Stack

Astro 7 + TypeScript + Tailwind CSS v4 (vía `@tailwindcss/vite`). Output **static**
(sin adapter). Sin CMS ni base de datos. Íconos SVG inline (sin librerías de íconos).
Fuente del sistema: **Arial / Helvetica / sans-serif** (no requiere web fonts).

## Estructura

- `src/pages/index.astro` — landing (ensambla las secciones en orden)
- `src/pages/404.astro` — no encontrado
- `src/layouts/BaseLayout.astro` — `<head>`, meta/OG, JSON-LD `Organization` (NAP Colombia)
- `src/components/layout/` — `Header.astro`, `Footer.astro`
- `src/components/sections/` — `Hero`, `Lineas`, `EconomiaCircular`, `Clientes`,
  `QuienesSomos`, `Contacto` (una sección = un componente `.astro`)
- `src/components/CircularArrow.astro` — ícono de marca (flecha circular)
- `src/styles/globals.css` — tokens de diseño + reset
- `public/videos/` — poster del hero (placeholder); el video real lo entrega el cliente
- `public/favicon.svg`, `public/og-image.svg` — assets de marca (placeholders)

## Orden de secciones (handoff)

Header sticky · Hero (video de fondo) · Líneas de negocio (3) · Economía circular
(anillo SVG desktop / lista móvil) · Banda de clientes · Quiénes somos · Contacto · Footer.

## Breakpoints

- ≤960px: footer 3→2 columnas
- ≤900px: "Quiénes somos" y "Contacto" 2→1 columna
- ≤720px: diagrama circular → lista vertical apilada
- ≤640px: header se apila, paddings reducidos, footer 1 columna, imagen 300px
- ≤430px: enlaces de nav a 12px

## Reglas

1. **No portar** el runtime "Design Components" del prototipo (`.dc.html` / `support.js`):
   es solo referencia visual. Recrear con patrones de Astro/Tailwind.
2. Una sección por componente en `components/sections`. Sin barrel exports.
3. Astro estático por defecto. Este sitio **no usa React islands** todavía (sin JS de cliente).
4. Media siempre optimizada antes de commitear.
5. Coherencia de marca: verde `#3A8C2F`, Arial, layout máx 1220px, gutter 32px.

## Pendientes de cliente (placeholders en el código)

- **Video del hero** (`public/videos/hero.mp4|webm` + `hero-poster.jpg`). Ver
  `public/videos/README.md`.
- **Foto "Quiénes somos"** (placeholder rayado en `QuienesSomos.astro`).
- **Logos de clientes** (hoy en texto, en `Clientes.astro`).
- **Correo real** — `PUBLIC_CONTACT_EMAIL` (placeholder `contacto@ci-quality-group.com`).
- **Dominio raíz** — `PUBLIC_SITE_URL` / `site` en `astro.config.mjs`.
- **Página de privacidad (Ley 1581/2012)** — pendiente; añadir `/privacidad` + enlace en footer
  cuando el cliente entregue el texto legal (no está en el handoff visual).

## Environment Variables

| Variable | Descripción |
|----------|-------------|
| `PUBLIC_SITE_URL` | URL pública (canonical / OG). Default `https://ci-quality-group.com` |
| `PUBLIC_CONTACT_EMAIL` | Correo de contacto mostrado. Placeholder `contacto@ci-quality-group.com` |

## Deploy (Vercel)

Se despliega en **Vercel** (unificado con el chatbot), NO en Cloudflare. Cloudflare solo
gestiona el DNS de `ci-quality-group.com` (nameservers kai/maya.ns.cloudflare.com).

- Proyecto Vercel propio, **Root Directory = `apps/website`** (igual que el chatbot usa
  `apps/chatbot`). Framework: **Astro** (estático, sin adapter). Config en `vercel.json`.
- Build: `pnpm run build` (= `astro build`) → output `dist`. Vercel resuelve el workspace
  pnpm desde la raíz automáticamente.
- Dominios: apex `ci-quality-group.com` + `www.` en ESTE proyecto. El chatbot conserva
  solo `bot.ci-quality-group.com`.
- `PUBLIC_SITE_URL=https://ci-quality-group.com` como env var del proyecto.
