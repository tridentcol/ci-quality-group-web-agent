import { readFileSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Carga .env.local (luego .env) para que drizzle-kit tenga DATABASE_URL sin depender de Next.
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
    }
  } catch {
    // archivo ausente — se ignora
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida (revisa apps/chatbot/.env.local).')
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
})
