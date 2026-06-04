# CI Quality Group — PROGRESS

Estado vivo del build del monorepo. Fuente del orden: plan maestro §2/§8 y el Build Order de cada blueprint.
Marca `[x]` solo lo verificado. No empieces una fase sin cerrar el gate de la anterior.

> 👉 SIGUIENTE: **Step 13 del chatbot** — Cumplimiento (Habeas Data / Ley 1581/2012): aviso de privacidad + job Inngest de retención que borra conversaciones/mensajes (y perfiles) vencidos según `bot_config.retention_months`; permitir borrado de perfil bajo solicitud.
>
> ✅ Step 12 (Panel: Dashboard + Settings) hecho (2026-06-03): `(panel)/dashboard` server con KPIs reales (conversaciones, relevos, leads nuevos, huecos, fuentes listas, materiales activos vía `db.$count`, tarjetas enlazadas). `(panel)/settings` (server carga `bot_config`) + `settings-form` cliente (nombre/tono, bienvenida, fuera de horario, horario con días+apertura/cierre, toggles de canal, WhatsApp admin, descuento máx, retención) + `api/panel/config` (GET/PATCH Zod). Verificado con `scripts/config-smoke.ts` (`pnpm --filter chatbot config:smoke`) + build verde.
>
> ✅ Step 11 (Panel: Leads + Conversaciones + Huecos) hecho (2026-06-03): APIs `api/panel/{leads,conversations,gaps}` + páginas. Leads: GET (join material+canal) / PATCH (estado, `discountApprovedPct`). Conversaciones: GET lista (con conteo) y `?id=` hilo / PATCH toggle estado (tomar=`human_controlled`/liberar=`bot_active`/cerrar); página lista + `[id]` con hilo y botones. Huecos: GET (open/all) / PATCH resolver → crea fuente `faq` + `chunkText`+`embedBatch` (recuperable por RAG, **bucle de aprendizaje cerrado**). Verificado con `scripts/panel-smoke.ts` (`pnpm --filter chatbot panel:smoke`) + build verde.
>
> ✅ Step 10 (Integración Meta) hecho (2026-06-03): `lib/meta/{verify,normalize,send,notify}.ts` + `app/api/webhooks/meta/route.ts`. GET handshake (verify_token) + POST (firma HMAC `X-Hub-Signature-256`, 200 <20s con `after()` de next/server, procesa en 2º plano). `normalize` cubre Messenger/Instagram (formato page) y WhatsApp Cloud + detección de echo. Pipeline `handle.ts`: idempotencia (`webhook_events`) → echo→`human_controlled` → guarda entrante → si humano lleva el hilo no responde → `loadMemory`→`generateReply`→`appendMessage`→`send` → dispara `memory/summarize`. `notifyAdmin` ahora envía WhatsApp real (con fallback a log). Verificado con `scripts/webhook-smoke.ts` (`pnpm --filter chatbot webhook:smoke`, unit + e2e) + build verde. Meta `VERIFY_TOKEN`/`APP_SECRET` de PRUEBA en `.env.local`.
>
> ✅ Step 9B (Memoria 3 capas) hecho (2026-06-03): `lib/ai/memory.ts` (perfil get-or-create por `(channel, external_id)`, `loadMemory`/`appendMessage`/`loadRecentMessages`, `buildCustomerSummary`/`mergeFacts`/`parseFacts`) + `generateReply` ahora acepta `conversationSummary`. Jobs Inngest `memory/update-profile` (extrae `facts` con el modelo y fusiona) y `memory/summarize` (resume lo antiguo en `conversations.summary`), registrados en `/api/inngest`. Verificado end-to-end con `scripts/memory-smoke.ts` (`pnpm --filter chatbot memory:smoke`) vía Dev Server + build verde.
>
> ✅ Step 9 (Motor de generación) hecho (2026-06-03): `lib/ai/system-prompt.ts` (puro: identidad+tono desde `bot_config`+reglas no negociables+memoria+contexto), `lib/ai/router.ts` (`selectModel`: mini→GPT-4o por longitud/tecnicismo/fallo RAG) y `lib/ai/generate.ts` (`generateReply`: RAG→router→system prompt→OpenAI con tool-calling en bucle→respuesta). Verificado end-to-end con `scripts/generate-smoke.ts` (`pnpm --filter chatbot generate:smoke`): pregunta de precio→`lookup_price`→mayorista 26.000 sin inventar + build verde.
>
> ✅ Step 8 (Tools del bot) hecho (2026-06-03): `lib/ai/tools.ts` con `lookup_price` (retail/mayorista por umbral, inactivo→no disponible), `capture_lead` (inserta lead + enlaza material + avisa admin), `request_human_handoff` (status `human_controlled` + aviso), `get_location` (RAG) y `log_knowledge_gap`. `toolDefinitions` para function-calling + `executeTool(name,args,ctx)`. Stub `lib/meta/notify.ts:notifyAdmin` (Step 10 hará el envío real). Verificado con `scripts/tools-smoke.ts` (`pnpm --filter chatbot tools:smoke`) + build verde.
>
> ✅ Step 7 (Precios) hecho (2026-06-03): `app/(panel)/pricing` (tabla editable) + `api/panel/pricing` (GET/POST/PATCH/DELETE, Zod, numeric COP como string). CRUD verificado con `pnpm --filter chatbot exec tsx --env-file=.env.local scripts/pricing-smoke.ts` + typecheck verde. ⏳ visual en navegador pendiente de login Clerk.
>
> ✅ Step 6 CERRADO end-to-end (2026-06-03): ingesta probada vía Inngest Dev Server local. Clave: añadir `INNGEST_DEV=1` a `.env.local` (sin esto el SDK arranca en "cloud mode" y `/api/inngest` da 500). Flujo verificado: texto → Blob privado → evento `ingest/source.uploaded` → job `ingest-source` → 1 chunk con embedding 1536-dim → `status=ready`; borrado en cascada OK. Scripts nuevos: `pnpm --filter chatbot ingest:smoke` y `ingest:check <id>`.
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
- [x] **Step 4** — IA: embeddings + retrieval (RAG): `lib/ai/{openai,embed,retrieve}.ts` + `scripts/rag-smoke.ts` — **smoke test verde** (insert→recupera por coseno, score 0.66). `OPENAI_API_KEY` en Vercel Production ✓
- [x] **Step 5** — Pipeline de ingesta (Inngest): `lib/ingest/{chunk,parse,scrape}.ts` + `inngest/{client,functions/ingest-source}.ts` + `/api/inngest` — chunking + build OK. **End-to-end verificado** (subir→`ready`) vía Inngest Dev Server con `INNGEST_DEV=1` ✓
- [x] **Step 6** — Panel: Conocimiento — UI (archivo/enlace/texto) + API (Blob privado, dispara Inngest, lista, borra cascade) + polling. **End-to-end verificado** vía Inngest Dev Server (`INNGEST_DEV=1`): texto → Blob → job `ingest-source` → chunk con embedding → `ready`; cascade OK ✓
- [x] **Step 7** — Panel: Precios — `app/(panel)/pricing` (tabla editable: nombre/categoría/unidad/minorista/mayorista/umbral/activo) + `api/panel/pricing` (GET/POST/PATCH/DELETE, Zod, numeric COP↔string). **CRUD verificado** (`scripts/pricing-smoke.ts`) + typecheck ✓. ⏳ visual en navegador pendiente de login Clerk
- [x] **Step 8** — Tools del bot — `lib/ai/tools.ts`: `lookup_price` (retail/mayorista por `wholesale_threshold`, inactivo→no disponible), `capture_lead` (+enlaza material +`notifyAdmin`), `request_human_handoff` (status `human_controlled`), `get_location` (RAG), `log_knowledge_gap`. `toolDefinitions` + `executeTool`. **Verificado** (`scripts/tools-smoke.ts`) + build ✓. notify real → Step 10
- [x] **Step 9** — Motor de generación — `lib/ai/system-prompt.ts` (puro, reglas no negociables) + `lib/ai/router.ts` (`selectModel` mini→GPT-4o) + `lib/ai/generate.ts` (`generateReply`: RAG+router+tool-calling en bucle). **Verificado** end-to-end (`scripts/generate-smoke.ts`) + build ✓
- [x] **Step 9B** — Memoria 3 capas — `lib/ai/memory.ts` (perfil get-or-create, `loadMemory`/`appendMessage`, `buildCustomerSummary`/`mergeFacts`) + `generateReply(conversationSummary)`; jobs Inngest `memory/update-profile` (extrae+fusiona `facts`) y `memory/summarize` (→ `conversations.summary`). **Verificado** e2e (`scripts/memory-smoke.ts`) vía Dev Server + build ✓. Unificación entre canales por `contact` y borrado por privacidad → Step 13
- [x] **Step 10** — Integración Meta: webhook unificado — `lib/meta/{verify,normalize,send,notify}.ts` + `app/api/webhooks/meta/route.ts` (GET verify_token + POST firma HMAC, 200 <20s con `after()`). `normalize` 3 canales + echo; `handle.ts` pipeline (idempotencia `webhook_events`, echo→`human_controlled`, `loadMemory→generateReply→send`, dispara summarize); `notifyAdmin` envía WhatsApp real. **Verificado** (`scripts/webhook-smoke.ts` unit+e2e) + build ✓. Conexión real de canales → Step 16
- [x] **Step 11** — Panel: Leads + Conversaciones + Huecos — APIs `api/panel/{leads,conversations,gaps}` + páginas (`leads`, `gaps`, `conversations` + `[id]`). Leads (estado/descuento), Conversaciones (lista+hilo+toggle tomar/liberar/cerrar), Huecos (resolver inline → fuente `faq` embebida, recuperable por RAG). **Verificado** (`scripts/panel-smoke.ts`) + build ✓
- [x] **Step 12** — Panel: Dashboard + Settings — `(panel)/dashboard` con KPIs reales (`db.$count`) + `(panel)/settings` + `settings-form` + `api/panel/config` (GET/PATCH `bot_config`: identidad/tono, mensajes, horario, canales, admin WhatsApp, descuento máx, retención). **Verificado** (`scripts/config-smoke.ts`) + build ✓
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

### Infra / Deploy (adelantado del Step 15)
- [x] Repo en GitHub `tridentcol/ci-quality-group-web-agent` (`origin/main`)
- [x] Proyecto Vercel `ci-quality-group-chatbot` (team daniels-projects) + repo conectado (auto-deploy en push)
- [x] Env vars de **Production** en Vercel (DATABASE_URL, claves Clerk, URLs Clerk)
- [x] **Root Directory = `apps/chatbot`** en Vercel
- [x] **Primer deploy de producción VERDE** (commit a526322) — app renderiza, Clerk carga
- [ ] (opcional) Desactivar **Vercel Deployment Protection** para URL pública, o usar enlace de bypass
- [ ] (Step 15/16) Instancia de producción de Clerk + dominio `panel.<dominio>` + env vars de Preview

> Aprendizaje pnpm 11.3: aprobar build scripts con `allowBuilds: {paquete: true}` en
> pnpm-workspace.yaml (NO `onlyBuiltDependencies`/`ignoredBuiltDependencies`, que ya no
> silencian ERR_PNPM_IGNORED_BUILDS). Sin esto, `pnpm install` sale 1 en CI/Vercel.

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
