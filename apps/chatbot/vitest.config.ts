import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests unitarios deterministas (sin red ni BD). La integración con BD/OpenAI
// vive en los scripts *:smoke (requieren servidores/credenciales).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
