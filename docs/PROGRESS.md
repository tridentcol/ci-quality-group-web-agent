# CI Quality Group — PROGRESS

Estado vivo del build del monorepo. Fuente del orden: plan maestro §2/§8 y el Build Order de cada blueprint.
Marca `[x]` solo lo verificado. No empieces una fase sin cerrar el gate de la anterior.

> 👉 SIGUIENTE: **Step 4 del chatbot** — IA: embeddings + retrieval (RAG). `lib/ai/embed.ts` (text-embedding-3-small), `lib/ai/retrieve.ts` (embeber consulta → `ORDER BY embedding <=> $query LIMIT k`, cosine → top-K). Test: insertar un chunk y recuperarlo por similitud. Requiere `OPENAI_API_KEY` (Fase 0).
>
> Infra Neon: proyecto `quality-group-web`, branch `chatbot-dev` (PG18, sa-east-1). `DATABASE_URL` en `apps/chatbot/.env.local`.
> Clerk: Next 16 usa `proxy.ts` (no `middleware.ts`) y `<Show>` (no `<SignedIn/SignedOut>`). Pendiente: pegar `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` en `.env.local` y probar login real.

---

## Monorepo (init — una vez · plan maestro §1.5)
- [x] `pnpm-workspace.yaml`
- [x] `package.json` raíz con scripts dev:bot/dev:web/build:bot/build:web
- [x] `CLAUDE.md` raíz (mapa del monorepo)
- [x] `packages/shared` (@cqg/shared) con `chat-contract.ts` y `brand.ts`
- [x] `docs/` con los documentos
- [x] `docs/PROGRESS.md`

---

## FASE A — CHATBOT (el cerebro) · se construye primero
Blueprint: `docs/ci-quality-group-chatbot-blueprint.md` §9 (Steps 1–16). Memoria: plan maestro §3.

- [x] **Step 1** — Scaffolding (`apps/chatbot`, Next.js 16 + TS + Tailwind, env Zod, shadcn/ui, su CLAUDE.md) — build verificado ✓
- [x] **Step 2** — Base de datos (Neon + pgvector): schema Drizzle (10 tablas), migración con `CREATE EXTENSION vector` + índice HNSW, seed — aplicado y verificado en Neon ✓
- [x] **Step 3** — Auth del panel (Clerk): `proxy.ts` protege `(panel)/*` y `/api/panel/*`, layout con sidebar + guard, /sign-in — build OK · ⏳ falta probar login real con claves
- [ ] **Step 4** — IA: embeddings + retrieval (RAG)
- [ ] **Step 5** — Pipeline de ingesta (Inngest): parse/scrape/chunk + job ingest-source
- [ ] **Step 6** — Panel: Conocimiento (subida a Blob, estado, borrado cascade)
- [ ] **Step 7** — Panel: Precios (tabla editable, COP)
- [ ] **Step 8** — Tools del bot (lookup_price, capture_lead, request_human_handoff, get_location, log_knowledge_gap)
- [ ] **Step 9** — Motor de generación (system-prompt + router mini→GPT-4o + generate)
- [ ] **Step 9B** — Memoria 3 capas (corto + customer_profiles + RAG; jobs update-profile/summarize)
- [ ] **Step 10** — Integración Meta: webhook unificado (verify/normalize/send/notify, idempotencia, echo)
- [ ] **Step 11** — Panel: Leads + Conversaciones + Huecos (toggle tomar/liberar, resolver hueco → faq)
- [ ] **Step 12** — Panel: Dashboard + Settings
- [ ] **Step 13** — Cumplimiento (Habeas Data / Ley 1581/2012): privacidad + job de retención
- [ ] **Step 14** — Testing (Vitest: lookup_price, chunk, normalize; integración webhook)
- [ ] **Step 15** — Deploy (Vercel + Blob + Inngest; subdominio `panel.<dominio>`)
- [ ] **Step 16** — Conexión de canales Meta (webhook, suscripciones, prueba real por canal)

**Gate A→B** (plan maestro §2):
- [ ] Bot responde en los 3 canales con RAG estricto
- [ ] Panel operativo (conocimiento, precios, leads/huecos/conversaciones)
- [ ] Memoria funcionando (corto plazo + perfil de cliente)
- [ ] Handoff humano funcionando (echo → pausa + aviso WhatsApp)
- [ ] Desplegado en `panel.<dominio>` y estable
- [ ] Número de WhatsApp del bot activo

---

## FASE B — SITIO WEB (la cara) · se construye después
Blueprint: `docs/ci-quality-group-website-blueprint.md` (Steps 1–12). Usa `@cqg/shared` para el contrato.

- [ ] Steps 1–12 del blueprint web
- [ ] `ChatWidget` cableado pero **apagado** (`PUBLIC_ENABLE_WEB_CHAT=false`)

**Gate B→C** (plan maestro §2):
- [ ] Landing desplegada en el dominio raíz (Cloudflare Pages)
- [ ] CTA de WhatsApp abre el deep link y cae en el bot (probado en móvil real)
- [ ] `ChatWidget` presente pero apagado, sin coste
- [ ] Lighthouse > 90, SEO local

---

## FASE C — Activación del chat web (última milla) · opcional
Plan maestro §5.

- [ ] Ruta `/api/chat/web` viva en el chatbot (canal `web`) + CORS para el dominio raíz, tipada con `@cqg/shared`
- [ ] `PUBLIC_ENABLE_WEB_CHAT=true` + `PUBLIC_CHATBOT_API_URL` en la web
- [ ] El widget conversa y alimenta la misma memoria/handoff
