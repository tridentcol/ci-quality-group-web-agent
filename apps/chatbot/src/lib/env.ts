import { z } from 'zod'

/**
 * Validación de variables de entorno (blueprint §10).
 *
 * Step 1: todas las variables son opcionales para que el scaffolding compile y
 * arranque sin secretos. A medida que cada Step las consuma, conviértelas en
 * requeridas (`.min(1)`) — así el fallo es temprano y explícito, no en runtime.
 */
const envSchema = z.object({
  // Base de datos (Step 2)
  DATABASE_URL: z.string().optional(),

  // OpenAI (Step 4/9)
  OPENAI_API_KEY: z.string().optional(),

  // Clerk (Step 3)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  // Meta — verificación de webhooks (Step 10)
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  // Versión del Graph API (fijada/pin). Vigente al implementar: v25.0; v21.0 sigue
  // siendo válida. Configurable por env para no tocar código en cada upgrade.
  GRAPH_API_VERSION: z.string().optional(),

  // Imagen de mapa para la tarjeta de ubicación en Messenger/IG (Google Static Maps).
  // Opcional: si falta, la tarjeta va sin imagen (solo dirección + botón "Abrir en Maps").
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Notificaciones al admin (opcional): también se pueden configurar desde la UI.
  // El valor de la UI tiene prioridad; estos sirven como respaldo o alternativa segura.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Canal Messenger (Step 10/16)
  MESSENGER_PAGE_ID: z.string().optional(),
  MESSENGER_PAGE_ACCESS_TOKEN: z.string().optional(),

  // Canal Instagram (Step 10/16)
  IG_ACCOUNT_ID: z.string().optional(),
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),

  // Canal WhatsApp (Step 10/16)
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  // Notificaciones admin (Step 8/10)
  ADMIN_WHATSAPP_NUMBER: z.string().optional(),

  // Vercel Blob (Step 5/6)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Inngest (Step 5)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // App
  APP_URL: z.string().url().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:', z.treeifyError(parsed.error))
  throw new Error('Variables de entorno inválidas. Revisa .env.local contra .env.example.')
}

export const env = parsed.data
export type Env = z.infer<typeof envSchema>
