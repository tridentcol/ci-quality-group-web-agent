# HANDOFF — CI Quality Group (chatbot)

> Punto de retome para una sesión nueva. Estado vivo y checklist: `docs/PROGRESS.md`.
> Última actualización: build del chatbot Steps 1–6 completo; deploy de producción verde.

## TL;DR — dónde estamos
- **Monorepo** inicializado (pnpm workspaces): `apps/chatbot` (Next.js 16) + `packages/shared` (@cqg/shared) + `docs/`.
- **Chatbot Steps 1–6 hechos** (blueprint `docs/ci-quality-group-chatbot-blueprint.md` §9):
  1. Scaffolding · 2. BD Neon+pgvector · 3. Auth Clerk · 4. RAG (✅ verificado) · 5. Ingesta Inngest (código) · 6. Panel Conocimiento (código).
- **Desplegado y público:** https://ci-quality-group-chatbot.vercel.app (deploy verde, auto-deploy en push a `main`).
- Todo commiteado y pusheado a `origin/main` (`tridentcol/ci-quality-group-web-agent`).

## 👉 Próximo paso
1. **Cerrar Step 6 end-to-end** (subir doc → Inngest → chunks `ready`). Falta ejecutar la ingesta:
   - **Opción local (elegida):** MCP `inngest-dev` añadido (`http://localhost:8288/mcp`). Para usarlo: corre `pnpm dev:bot` **y** `npx inngest-cli@latest dev` (levanta localhost:8288), **reinicia Claude** para que el MCP conecte, sube un doc en `/knowledge` y verifica que pasa a `ready`.
   - **Opción producción:** poner `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` en `.env.local` + Vercel Production, sync de la app Inngest a `…/api/inngest`, subir en el panel desplegado.
2. **Step 7 — Precios** (no depende de Inngest): `app/(panel)/pricing` + `app/api/panel/pricing` (tabla editable de `materials` en COP).
3. Luego Steps 8–16 (tools, generación+system prompt, memoria §3, webhook Meta, leads/conversaciones/huecos, dashboard/settings, cumplimiento, tests, deploy, canales).

## Infraestructura (cuentas y recursos)
| Servicio | Detalle |
|---|---|
| **GitHub** | `tridentcol/ci-quality-group-web-agent`, branch `main` (gh CLI autenticado como tridentcol) |
| **Vercel** | proyecto `ci-quality-group-chatbot` · team `daniels-projects-8dbbaf4e` (`team_3bbaiNSZp6e3Zp500LOSGP6I`) · `prj_K6eRDrpeIEi71WtiFtwXW07zlrzo` · **Root Directory `apps/chatbot`** · git conectado · SSO protection OFF · MCP Vercel conectado |
| **Neon** | proyecto `quality-group-web` (`sweet-dream-35634370`) · branch `chatbot-dev` (`br-dawn-rice-acx4btzv`) · PG18 · sa-east-1 · 10 tablas + pgvector + HNSW + seed (bot_config id=1 + 5 materiales) |
| **Clerk** | instancia **desarrollo** (pk_test/sk_test) · login funciona en prod · admin se crea en dashboard de Clerk (sin registro abierto) |
| **OpenAI** | key con crédito · RAG smoke verde · en `.env.local` + Vercel Production |
| **Vercel Blob** | store `ci-quality-group-knowledge` (**privado**) · `BLOB_READ_WRITE_TOKEN` + `BLOB_STORE_ID` en `.env.local` (⚠️ falta añadir a Vercel Production para la ingesta en prod) |
| **Inngest** | MCP dev local añadido; **sin llaves de producción aún** |

## Variables de entorno
- **`apps/chatbot/.env.local`** (local, NO versionado) tiene: `DATABASE_URL`, Clerk (pk/sk + URLs), `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `APP_URL`. **Falta:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **Vercel Production** tiene: `DATABASE_URL`, Clerk (5), `OPENAI_API_KEY`. **Falta:** `BLOB_READ_WRITE_TOKEN`, `INNGEST_*`.
- Plantilla completa en `apps/chatbot/.env.example`. Validación en `src/lib/env.ts`.

## Comandos
```bash
pnpm dev:bot                      # dev server (localhost:3000)
pnpm --filter chatbot build       # build prod
pnpm --filter chatbot rag:smoke   # test RAG (insert→recupera) — necesita OPENAI_API_KEY
pnpm --filter chatbot seed        # re-sembrar bot_config + materiales
pnpm --filter chatbot db:generate # generar migración desde schema
pnpm --filter chatbot db:migrate  # aplicar migraciones a Neon
npx inngest-cli@latest dev        # Inngest Dev Server (localhost:8288) para ingesta local
```

## ⚠️ Gotchas aprendidos (NO re-tropezar)
- **pnpm 11.3:** aprobar build scripts con `allowBuilds: { paquete: true }` en `pnpm-workspace.yaml` (NO `onlyBuiltDependencies`/`ignoredBuiltDependencies` — no silencian `ERR_PNPM_IGNORED_BUILDS` y el build de Vercel falla). Si entra un dep nuevo con build script, añádelo en `true` (o `false` si no se necesita, p.ej. `tesseract.js`).
- **Next.js 16:** el middleware se llama **`proxy.ts`** (no `middleware.ts`).
- **Clerk v7:** usar `<Show when="signed-in">` (no `<SignedIn>/<SignedOut>`); `clerkMiddleware` + `createRouteMatcher` en `proxy.ts`.
- **inngest 4.5:** `createFunction({ id, triggers: [{ event }] }, handler)` (2 args, trigger dentro de la config).
- **Vercel Blob privado:** descargar con `get(url, { access: 'private' })` (no `fetch` directo).
- **Vercel Root Directory** solo se fija en el dashboard (ni CLI ni MCP lo cambian).
- **Registro npm lento:** `pnpm-workspace.yaml` tiene `networkConcurrency: 1` + timeouts altos — no quitar.
- **Acceso prod 401** = Vercel Deployment Protection (ya desactivada); no es bug de la app.
- Los **MCP añadidos a mitad de sesión** requieren reiniciar Claude para conectarse.
