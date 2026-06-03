import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida. Copia .env.example a .env.local y rellénala.')
}

// Una sola conexión reutilizable. prepare:false → compatible con el pooler de Neon.
const client = postgres(env.DATABASE_URL, { prepare: false })

export const db = drizzle(client, { schema })
