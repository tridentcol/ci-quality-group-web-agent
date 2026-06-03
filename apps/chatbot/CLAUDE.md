@AGENTS.md

# CI Quality Group — Chatbot

Asistente de atención al cliente con IA (RAG) para Messenger, WhatsApp e Instagram, con panel de administración. Empresa: disposición final de desechos, chatarrización y compra/venta de chatarra (Colombia).

> Parte del monorepo (ver CLAUDE.md raíz). Trabaja esta app con `pnpm --filter chatbot ...`.
> Tipos del contrato y tokens de marca compartidos viven en `@cqg/shared` — no los dupliques aquí.
> Estado del build y siguiente paso: `docs/PROGRESS.md` (en la raíz).

## Commands

- `pnpm dev` — Servidor de desarrollo
- `pnpm build` — Build de producción
- `pnpm lint` — Linter
- `pnpm test` — Tests (Vitest)
- `pnpm drizzle-kit generate` — Generar migración desde el esquema
- `pnpm drizzle-kit migrate` — Aplicar migraciones
- `pnpm tsx src/lib/db/seed.ts` — Semilla (bot_config + materiales demo)

## Tech Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + PostgreSQL/pgvector (Neon) + Drizzle + Clerk + Inngest + OpenAI (GPT-4o-mini / GPT-4o / text-embedding-3-small) + Vercel.

## Architecture

### Directory Structure
- `src/app/(panel)/` — Panel de administración (protegido por Clerk)
- `src/app/api/webhooks/meta/` — Webhook unificado de los 3 canales Meta (público, firma HMAC)
- `src/app/api/panel/` — API interna del panel (protegida)
- `src/lib/ai/` — RAG: embed, retrieve, generate, tools, system-prompt, router
- `src/lib/ingest/` — parse (PDF/DOCX/PPTX/TXT), scrape (links), chunk
- `src/lib/meta/` — verify, normalize, send, notify
- `src/lib/db/` — schema Drizzle, cliente, migraciones, seed
- `src/inngest/` — jobs de ingesta en background

### Data Flow
Mensaje del cliente → webhook Meta (verifica firma, responde 200 < 20s, procesa con waitUntil) →
normalize → si es echo o human_controlled NO responder → cargar memoria (customer_profiles +
summary + últimos mensajes) → RAG (embed query → buscar chunks) → generate (system-prompt con
tono + perfil del cliente + contexto + tools) → ejecutar tools (lookup_price, capture_lead,
handoff, get_location, log_knowledge_gap) → send por canal. Post-conversación: jobs Inngest
memory/update-profile y memory/summarize. Ingesta: subir doc → Blob → Inngest → parse → chunk →
embed → knowledge_chunks.

### Key Patterns
- Server Components por defecto; "use client" solo para interactividad (subida, toggles, polling).
- Toda consulta a BD pasa por `src/lib/db`. Toda entrada se valida con Zod.
- El webhook SIEMPRE responde 200 a Meta; los errores se loguean, no se propagan.
- El bot SOLO responde con contexto recuperado. Si no hay contexto → log_knowledge_gap + deriva.
- El bot NUNCA inventa precios: solo `lookup_price` desde la tabla `materials`.
- Descuentos: el bot solo ofrece hasta `bot_config.max_auto_discount_pct`; más → captura lead y deriva al admin.
- Relevo: un mensaje "echo" (humano respondió en Meta) marca conversation.status=human_controlled y silencia el bot.
- Memoria 3 capas: corto (últimos N mensajes), largo (customer_profiles inyectado al system prompt), conocimiento (RAG). Resúmenes en conversations.summary para acotar tokens.

## Code Organization Rules

1. Un componente por archivo. Máx 300 líneas; si crece, extraer subcomponentes.
2. Alias `@/` para imports desde `src/`.
3. Sin barrel exports; importar del archivo fuente.
4. Server Components por defecto.
5. Colocar componentes específicos de una página junto a su página.

## Design System

### Colors
Primary `#15803D`, Primary-hover `#166534`, Background `#F8FAFC`, Surface `#FFFFFF`,
Text `#0F172A`, Muted `#64748B`, Border `#E2E8F0`, Destructive `#DC2626`,
Success `#16A34A`, Warning `#D97706`. (Fuente compartida: `@cqg/shared/brand`.)

### Typography
- Headings: Inter, 600, 20–32px
- Body: Inter, 400, 14–16px
- Data/Code: JetBrains Mono, 13px

### Style
- Border radius: 8px (12px tarjetas, full badges/avatares)
- Sombras sutiles; transiciones 150ms; tablas densas y legibles
- Badges de estado: verde=ready, ámbar=pendiente, rojo=fallido
- Estética: limpia, profesional, industrial-confiable. Español de Colombia. Moneda COP.

## Environment Variables

Ver `.env.example`. Validación en `src/lib/env.ts` (Zod). Resumen:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres Neon (pgvector) |
| `OPENAI_API_KEY` | Generación + embeddings |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Auth del panel |
| `META_APP_SECRET` / `META_VERIFY_TOKEN` | Verificación de webhooks |
| `MESSENGER_PAGE_ID` / `MESSENGER_PAGE_ACCESS_TOKEN` | Canal Messenger |
| `IG_ACCOUNT_ID` / `INSTAGRAM_ACCESS_TOKEN` | Canal Instagram |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_BUSINESS_ACCOUNT_ID` / `WHATSAPP_ACCESS_TOKEN` | Canal WhatsApp |
| `ADMIN_WHATSAPP_NUMBER` | Avisos de leads/relevos al admin |
| `BLOB_READ_WRITE_TOKEN` | Almacenamiento de documentos |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Jobs de ingesta |
| `APP_URL` | https://panel.<dominio> |

## Reglas No Negociables

1. El bot NUNCA inventa información ni precios. Solo responde con contexto RAG y `lookup_price`.
2. Si no hay respuesta en el conocimiento → `log_knowledge_gap` y derivar, nunca improvisar.
3. El webhook responde 200 a Meta en < 20s; el procesamiento pesado va a Inngest/waitUntil.
4. Validar TODA entrada con Zod (webhooks, formularios, env). Verificar firma HMAC siempre.
5. Nunca commitear `.env*`. Todos los secretos por variables de entorno.
6. Tono del bot: natural, neutral, formal, profesional, directo. Sin adornos ni exageración.
7. Respetar `retention_months` (Habeas Data / Ley 1581 de 2012): borrar conversaciones vencidas.
