# CI Quality Group — PROGRESS

Estado vivo del build del monorepo. Fuente del orden: plan maestro §2/§8 y el Build Order de cada blueprint.
Marca `[x]` solo lo verificado. No empieces una fase sin cerrar el gate de la anterior.

> 👉 SIGUIENTE: **Step 16 del chatbot** — Conexión de canales Meta (webhook en `https://bot.ci-quality-group.com/api/webhooks/meta`, suscripciones de Messenger/Instagram/WhatsApp, claves reales `META_*`/tokens de cada canal en Vercel Production, prueba real por canal). Con esto se cierra la FASE A y el Gate A→B. **Step 15 (Deploy a producción) CERRADO** ✅ (ver abajo). (El panel del chatbot vive en `bot.` porque `panel.`/`admin.` son de otro panel.)
>
> ✅ Step 15 — Clerk producción + login OK (2026-06-04): instancia de **producción de Clerk** creada para `bot.ci-quality-group.com` como **Secondary application** (API en `clerk.bot.ci-quality-group.com`, correo `@bot.…`; deja la raíz libre para el otro panel/web). 5 CNAME en Cloudflare **DNS-only** (`accounts`,`clerk`,`clk._domainkey`,`clk2._domainkey`,`clkmail` → `*.clerk.services`) **verificados**. Claves `pk_live`/`sk_live` en Vercel Production (reemplazan las `pk_test`/`sk_test`) + redeploy. Usuario admin creado en el entorno **Production** (pool propio, sin registro abierto). **Login verificado en `https://bot.ci-quality-group.com` sin banner de development.** → **Step 15 CERRADO**.
>
> ✅ Step 15 — ingesta end-to-end en prod + dominio (2026-06-04): **Ingesta** real verificada (PDF subido → `Listo`). Hubo 3 fixes encadenados: (1) subida daba **413** (el archivo pasaba por el lambda, límite 4.5 MB) → migrado a **client upload** de `@vercel/blob/client` con barra de progreso + route `/api/panel/knowledge/upload` (commit `528516b`); (2) **400 "Failed to retrieve the client token"** porque **`BLOB_READ_WRITE_TOKEN` faltaba en Vercel Production** → añadido con `vercel env add` + redeploy; (3) el job fallaba con **`DOMMatrix is not defined`** (pdf-parse usa pdf.js, que pide globals de navegador) → reemplazado por **`unpdf`** (pdf.js serverless, sin deps nativas; commit `73941bf`), `serverExternalPackages` queda en `[officeparser, mammoth]`. **Dominio:** `bot.ci-quality-group.com` agregado al proyecto Vercel (`vercel domains add`), CNAME `bot → cname.vercel-dns.com` en Cloudflare **DNS-only (nube gris)**; resuelve a IPs de Vercel, SSL emitido (`cert_VEVhcS6yqZ2…`, 90d), `https://bot.ci-quality-group.com/` → `307 /dashboard`. ⚠️ El login en ese dominio aún falla por Clerk **dev** (`dev-browser-missing`) → resolver con Clerk producción.
>
> ✅ Step 15 — `/api/inngest` sano en producción (2026-06-04): el endpoint daba **500** porque `route.ts → ingestSource → parse.ts` importaba a nivel de módulo los parsers nativos (`pdf-parse`→`@napi-rs/canvas`, `officeparser`, `mammoth`); registrar las funciones evaluaba esos imports y el binding nativo reventaba (`Warning: Cannot load @napi…` → `Failed to handle`). `serverExternalPackages` (commit `2feaac3`) evitaba el *bundling* pero no el *import* en runtime. **Fix** (`cd654e5`): `import()` diferido dentro de cada `case` de `parseDocument` → registrar el endpoint ya no toca módulos nativos. Ahora `GET /api/inngest` → **401 `{"message":"Unauthorized"}` con `x-inngest-sdk-handled: true`** = el SDK maneja la petición y rechaza el GET sin firma (correcto en cloud mode). Las 4 funciones (`ingest-source`, `update-profile`, `summarize`, `retention`) quedan registradas. Deploy `dpl_9z6gy6…` READY.
>
> ✅ Step 14 (Testing con Vitest) hecho (2026-06-03): Vitest instalado (config + setup + `test`/`test:watch`). 28 tests unitarios deterministas (sin red): `resolveLookup` (lógica de precios extraída a `lib/ai/pricing.ts`, mayorista/umbral/inactivo/exacto), `chunkText`, `normalize` (3 canales+echo+no-texto), `selectModel`, `verify` (firma HMAC + handshake). La integración con BD/OpenAI sigue en los scripts `*:smoke`. `pnpm --filter chatbot test` verde + build verde.
>
> ✅ Step 13 (Cumplimiento Habeas Data / Ley 1581) hecho (2026-06-03): página pública `/privacidad` (aviso de tratamiento de datos) enlazada desde Settings; job Inngest `compliance-retention` (cron diario `TZ=America/Bogota 0 3 * * *` + evento `compliance/retention.run`) borra conversaciones/perfiles/`webhook_events` vencidos según `bot_config.retention_months`; borrado bajo solicitud vía `DELETE /api/panel/conversations?id=&erase=customer` (cascade) con botones en el hilo (`conversation-view`). Verificado con `scripts/retention-smoke.ts` (`pnpm --filter chatbot retention:smoke`) + build verde.
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
- [x] **Step 3** — Auth del panel (Clerk): `proxy.ts` protege `(panel)/*` y `/api/panel/*`, layout con sidebar + guard, /sign-in — build OK · ✅ login real verificado en producción (`bot.ci-quality-group.com`, instancia Clerk Production)
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
- [x] **Step 13** — Cumplimiento (Habeas Data / Ley 1581/2012) — página pública `/privacidad`; job Inngest `compliance-retention` (cron + evento) borra conversaciones/perfiles vencidos por `retention_months`; borrado bajo solicitud (`DELETE /api/panel/conversations ?erase=customer`) + botones en el hilo. **Verificado** (`scripts/retention-smoke.ts`) + build ✓
- [x] **Step 14** — Testing (Vitest) — 28 tests unitarios: `resolveLookup` (precios, extraído a `lib/ai/pricing.ts`), `chunkText`, `normalize` (3 canales+echo), `selectModel`, `verify` (HMAC+handshake). `pnpm --filter chatbot test` verde. Integración BD/OpenAI en scripts `*:smoke`. **Verificado** + build ✓
- [x] **Step 15** — Deploy (Vercel + Blob + Inngest; subdominio `bot.ci-quality-group.com`) — **CERRADO** (2026-06-04): `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`, `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` y (2026-06-04) **`BLOB_READ_WRITE_TOKEN`** en Vercel **Production** (este último FALTABA y rompía la subida de conocimiento con 400 "Failed to retrieve the client token"; añadido vía `vercel env add` + redeploy). **Subida de archivos por client upload** (`@vercel/blob/client`, commit `528516b`): el navegador sube directo a Blob (evita el 413 del lambda de 4.5 MB) con barra de progreso; route `/api/panel/knowledge/upload` emite el token. ⚠️ **Pendiente Clerk:** la instancia es de **desarrollo** y en el dominio de prod el `POST` a veces da 404 (`x-clerk-auth-reason: dev-browser-missing`) → resolver con la **instancia de producción de Clerk**. `/api/inngest` **sano** (500→401, parsers nativos a `import()` diferido en `parse.ts`, commit `cd654e5`): el SDK responde 401 al GET sin firma (`x-inngest-sdk-handled: true`) y registra las 4 funciones. ✅ **Sync de Inngest Cloud HECHO** (2026-06-04): app **Synced** con las 4 funciones (`ingest-source`/`update-profile`/`summarize`/`retention`) y URL **estable** `https://ci-quality-group-chatbot.vercel.app/api/inngest` (no per-deployment → cada push a `main` se refleja solo). Recordar: cada deployment congela las env vars de su creación → tras cambiar llaves, **redeploy**. ✅ Sync Inngest Cloud HECHO. ✅ **Ingesta end-to-end en prod HECHA** (PDF → `Listo`; fixes 413→client upload, BLOB token, `DOMMatrix`→unpdf). ✅ **Dominio HECHO**: `bot.ci-quality-group.com` (CNAME DNS-only en Cloudflare, SSL emitido, `307 /dashboard`). ✅ **Clerk producción HECHO**: Secondary app, 5 CNAME verificados, `pk_live`/`sk_live` en Vercel + redeploy, admin creado en Production, **login verificado sin banner de development**. → Step 15 cerrado; sigue Step 16 (canales Meta).
- [ ] **Step 16** — Conexión de canales Meta (webhook, suscripciones, prueba real por canal)

### Trabajo en paralelo (sin Meta) — mientras tramita la verificación/App Review de Meta
La parte lenta de Meta es Business Verification + App Review (días). El pipeline se puede probar YA con número de PRUEBA de WhatsApp. Mientras tanto, avanzar en esto (no depende de Meta):
- [x] **Layout 100% responsive + navegación mobile** (2026-06-05, commit `3ffea28`): sidebar persistente solo en `lg+`; en móvil/tablet top bar + drawer (`mobile-nav.tsx`, overlay/Escape/link activo); tablas (`leads`/`conversations`/`pricing`/`knowledge`) → cards en `<md`; padding/typography responsive; settings con campos `flex-col sm:flex-row`. **Desplegado**; ⏳ pendiente verificación visual en prod por el usuario.
- [x] **Conocimiento v2** (2026-06-05, commit `fe8333c`): texto plano editable como fuente de verdad. Subir/link/texto → `/api/panel/knowledge/parse` extrae y **muestra un editor de preview** (`source-editor.tsx`) para corregir antes de guardar; se guarda solo el texto (`knowledge_sources.content`) y se **borra el blob** (menos storage). **Editar** una fuente → re-ingesta **en sitio** (borra chunks viejos, sin duplicados). Lista con nº de fragmentos/fecha. Migración 0001 (content/chunk_count/updated_at) aplicada en Neon.
- [x] **Panel de prueba `/playground`** (2026-06-05, commit `fe8333c`): pregunta como cliente → respuesta + modelo/router/contextUsed + **chunks recuperados con score** + tools usadas, en modo `dryRun` (no crea leads/huecos). Cierra el bucle de confianza. Ruta `/api/panel/playground`.
- [x] **Banco de imágenes + adjuntar a respuestas** (2026-06-05, commit `759dace`): tabla `images` (embedding) + `/images` (subir/editar/borrar, URL pública). Tool `find_image` gated (el bot adjunta solo imágenes aprobadas, nunca inventa URLs); `sendImage` por canal; `handle.ts` envía adjuntos. Migración 0002. ⚠️ Envío real a Meta se prueba en Step 16; hasta entonces se valida en `/playground`.
- [x] **Afinado de RAG + prioridad** (2026-06-05, commit `4b2ccd1`): `lib/ai/rag-config.ts` (MIN_SCORE 0.2→0.25); `knowledge_sources.priority` (migración 0003) con boost en `retrieve()` para que la info nueva/autoritativa gane ante empates.
- [x] **Set de regresión `pnpm --filter chatbot eval`** (2026-06-05, commit `4b2ccd1`): `src/eval/cases.ts` + `scripts/eval.ts` verifican señales (tools, contextUsed) en `dryRun`. 6/6 verde. (Atrapó un bug del retrieve antes de prod.)
- [x] **Trazabilidad por turno** (2026-06-05, commit `4b2ccd1`): `messages.metadata` (migración 0004) guarda model/router/contextUsed/scores/tools del bot; el hilo muestra un ⓘ "por qué respondió esto".
- [ ] **Cargar conocimiento real** en `/knowledge` (servicios, ubicaciones, horarios, FAQ, proceso de chatarrización/disposición) — el RAG sigue vacío de contenido real. Ahora con preview editable + prioridad.
- [ ] **Cargar precios reales** en `/pricing` (tabla `materials`) — `lookup_price` los necesita.
- [ ] **Cargar imágenes reales** en `/images` con buenas descripciones/etiquetas (lo que usa `find_image`).
- [ ] **Afinar `bot_config`** en `/settings` (tono, bienvenida, fuera de horario, descuento máx, WhatsApp admin).
- [ ] **Probar y afinar el bot** con `/playground` (web) o `pnpm --filter chatbot chat` (REPL). Verificar que no alucina, respeta precios/descuentos y deriva bien; medir scores para reajustar `RAG_MIN_SCORE` si hace falta.
- [ ] **Limpieza**: quitar `pdf-parse` (ya no se usa, reemplazado por `unpdf`) + añadir env vars a **Preview** en Vercel.
- [ ] **Adelantar materiales de App Review** de Meta (descripción del caso de uso + guion de screencast; política de privacidad ya existe en `/privacidad`).

**Gate A→B** (plan maestro §2):
- [ ] Bot responde en los 3 canales con RAG estricto
- [ ] Panel operativo (conocimiento, precios, leads/huecos/conversaciones)
- [ ] Memoria funcionando (corto plazo + perfil de cliente)
- [ ] Handoff humano funcionando (echo → pausa + aviso WhatsApp)
- [x] Desplegado en `bot.ci-quality-group.com` y estable (dominio + SSL + login con Clerk **producción** verificado)
- [ ] Número de WhatsApp del bot activo

---

### Infra / Deploy (adelantado del Step 15)
- [x] Repo en GitHub `tridentcol/ci-quality-group-web-agent` (`origin/main`)
- [x] Proyecto Vercel `ci-quality-group-chatbot` (team daniels-projects) + repo conectado (auto-deploy en push)
- [x] Env vars de **Production** en Vercel (DATABASE_URL, claves Clerk, URLs Clerk)
- [x] **Root Directory = `apps/chatbot`** en Vercel
- [x] **Primer deploy de producción VERDE** (commit a526322) — app renderiza, Clerk carga
- [ ] (opcional) Desactivar **Vercel Deployment Protection** para URL pública, o usar enlace de bypass
- [x] Dominio del panel: `bot.ci-quality-group.com` → Vercel (CNAME `bot`→`cname.vercel-dns.com`, Cloudflare DNS-only; SSL `cert_VEVhcS6yqZ2…`)
- [ ] (Step 15/16) Instancia de producción de Clerk + env vars de Preview

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
