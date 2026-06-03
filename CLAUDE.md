# CI Quality Group — Monorepo

Dos apps + un paquete compartido. pnpm workspaces.

## Estructura
- apps/chatbot   → Next.js, panel.<dominio> (Vercel). Guía: docs/ci-quality-group-chatbot-blueprint.md
- apps/website   → Astro, <dominio> (Cloudflare Pages). Guía: docs/ci-quality-group-website-blueprint.md
- packages/shared (@cqg/shared) → tipos del contrato /api/chat/web + tokens de marca
- docs/          → blueprints, plan maestro, prompts, README

## Reglas del monorepo
1. Trabaja SIEMPRE dentro de una app a la vez (apps/chatbot O apps/website). No mezcles cambios.
2. Cada app tiene su propio CLAUDE.md con sus reglas; respétalo al entrar.
3. Tipos/marca compartidos → packages/shared. No los dupliques en cada app.
4. Comandos con filtro: `pnpm --filter chatbot ...` / `pnpm --filter website ...`.
5. Cada app despliega por separado (Vercel / Cloudflare). No acoples sus configs.

## Scripts raíz
- `pnpm dev:bot` / `pnpm dev:web` — servidor de desarrollo de cada app
- `pnpm build:bot` / `pnpm build:web` — build de cada app

## Orden de construcción (plan maestro §2)
FASE A (chatbot) → gate A→B → FASE B (web) → gate B→C → FASE C (integración chat web).
Estado vivo y siguiente paso: **docs/PROGRESS.md**.

## Deploys (mismo repo, distinto destino)
- Vercel (chatbot): Root Directory = `apps/chatbot`.
- Cloudflare Pages (website): build `pnpm install && pnpm --filter website build`, output `apps/website/dist`.
