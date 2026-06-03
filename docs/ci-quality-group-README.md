# CI Quality Group — Ecosistema Digital · README Maestro

> Punto de entrada único. Generado por The Architect el 2026-06-03.
> **Empieza por aquí.** Este README enlaza y ordena los cuatro documentos del proyecto.

CI Quality Group ofrece **disposición final de desechos, chatarrización y compra/venta de chatarra** (Colombia). Este ecosistema digital tiene dos piezas que se construyen en secuencia y se conectan por un contrato mínimo:

- 🧠 **Chatbot con IA** (Next.js) en `panel.<dominio>` — atiende clientes por Messenger, WhatsApp e Instagram con un solo cerebro (RAG + memoria), más un panel de administración.
- 🎬 **Sitio web** (Astro) en `<dominio>` — landing cinematográfica, sin login, que conduce el tráfico a WhatsApp → bot. Preparada para incrustar un chat web con el mismo cerebro.

**Ambas viven en un MONOREPO** (pnpm workspaces) → `https://github.com/tridentcol/ci-quality-group-web-agent.git`. Estructura y deploys en el plan maestro **§1.5**.

```
ci-quality-group-web-agent/
├── apps/chatbot     (Next.js → Vercel)      ├── packages/shared  (@cqg/shared)
├── apps/website     (Astro → Cloudflare)    └── docs/            (estos 5 .md)
```

---

## 📁 Los 4 documentos (en orden de lectura)

| # | Documento | Qué es | Cuándo usarlo |
|---|-----------|--------|---------------|
| 1 | **[ci-quality-group-master-plan.md](./ci-quality-group-master-plan.md)** | 🧭 Plan maestro: orden global, sistema de memoria, handoff e integración | **Léelo primero.** Define cómo se mueve todo |
| 2 | **[ci-quality-group-chatbot-blueprint.md](./ci-quality-group-chatbot-blueprint.md)** | 🧠 Blueprint del bot + panel (con memoria integrada) | Fase A — se construye primero |
| 3 | **[ci-quality-group-website-blueprint.md](./ci-quality-group-website-blueprint.md)** | 🎬 Blueprint del sitio público | Fase B — se construye después |
| 4 | **[ci-quality-group-prompts.md](./ci-quality-group-prompts.md)** | ⌨️ Prompts copy-paste para Claude Code, optimizados en tokens | Al construir, en todas las fases |

---

## 🗺️ Cómo está conectado todo

```
                 <dominio>  (Cloudflare Pages)
                 ┌───────────────────────────────┐
                 │   SITIO WEB (Astro)           │
                 │   • Gráfico, sin login        │
                 │   • CTA → WhatsApp ───────────┼──►  wa.me  ──►  BOT
                 │   • [futuro] widget web ──────┼──►  /api/chat/web (mismo bot)
                 └───────────────────────────────┘
                                                       ▲
          panel.<dominio>  (Vercel)                    │
          ┌───────────────────────────────┐           │
          │   CHATBOT (Next.js)           │   Messenger·WhatsApp·Instagram
          │   • Webhook Meta (3 canales) ─┼───────────┘
          │   • Motor RAG + memoria       │
          │   • Panel admin               │
          └───────────────────────────────┘
```

---

## 🚦 Orden de construcción (resumen)

```
FASE 0  Prerrequisitos Meta ──────────────────────►  (empieza YA, es lo más lento)
FASE A  CHATBOT  ──gate──►  FASE B  WEB  ──gate──►  FASE C  Integración web-chat (opcional)
```

| Fase | Qué se hace | Documento guía |
|------|-------------|----------------|
| **0** | Verificación Meta, WABA, App Review, cuentas y API keys | Plan maestro §2 + Chatbot §17 |
| **A** | Construir el bot + panel + memoria + handoff | Chatbot blueprint (Steps 1–16) |
| **B** | Construir el sitio web (CTA→WhatsApp, integración apagada) | Website blueprint (Steps 1–12) |
| **C** | Encender el chat web (un endpoint + un flag) | Plan maestro §5 |

> **Regla:** no pases de fase sin cumplir sus *criterios de salida* (gates) del plan maestro §2.

---

## ⚡ Arranque rápido

1. **Hoy mismo:** inicia los trámites de Meta (Fase 0) — tardan semanas.
2. Clona el repo, mueve estos 5 documentos a `docs/`, abre Claude Code en la raíz y pega el prompt **S0** (inicializa el monorepo) de `ci-quality-group-prompts.md`.
3. Pega **A0** para arrancar el chatbot en `apps/chatbot`; avanza paso a paso (A1, A2, …) con commit + `/clear` entre cada uno.
4. Al cerrar el **gate A→B**, construye la web en `apps/website` con los prompts **B0**…
5. La integración (Fase C) cuando quieras: prompts **C1** y **C2**.

---

## 🧩 Decisiones clave (ya tomadas)

| Tema | Decisión |
|------|----------|
| Enfoque | Desarrollo propio sobre APIs (no no-code, no desde cero) → máximo control, coste mínimo |
| IA | **OpenAI** — GPT-4o-mini (default) → GPT-4o (escalado) + embeddings (1 proveedor, 1 factura) |
| Canales | Messenger (principal), WhatsApp e Instagram — un solo cerebro |
| Memoria | 3 capas: conversación · perfil de cliente · conocimiento (RAG) |
| Handoff | Bot → humano por *echo*, aviso por WhatsApp, devolución desde el panel |
| Web | Astro + Cloudflare Pages, CTA a WhatsApp, integración cableada y apagada |
| Stack bot | Next.js · Postgres+pgvector (Neon) · Drizzle · Clerk · Inngest · Vercel |
| País | Colombia — español, COP, Ley 1581/2012 (Habeas Data) |

---

## 💰 Coste operativo estimado

~**$10–40/mes** a volumen bajo-medio (OpenAI + Neon + Vercel + Cloudflare + Clerk/Inngest gratis). Detalle en el Anexo 18 del blueprint del chatbot. *Verificar precios actuales antes de presupuestar.*

---

## ✅ Checklist de alto nivel

- [ ] **Fase 0** — Meta verificado, WABA + número, App Review, API keys
- [ ] **Fase A** — Bot en los 3 canales + panel + memoria + handoff, desplegado en `panel.<dominio>`
- [ ] **Fase B** — Web desplegada en `<dominio>`, CTA→WhatsApp probado, integración apagada
- [ ] **Fase C** (opcional) — `/api/chat/web` vivo + widget encendido

El checklist detallado está en el plan maestro §8.
