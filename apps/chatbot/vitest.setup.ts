// Valores de entorno para los tests (deben existir antes de cargar src/lib/env).
// Solo lo que necesitan las unidades puras: verificación de firma/handshake de Meta.
process.env.META_APP_SECRET ||= 'test-app-secret'
process.env.META_VERIFY_TOKEN ||= 'test-verify-token'
