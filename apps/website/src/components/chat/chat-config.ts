/**
 * Configuración de la burbuja de chat web (blueprint §8).
 * El widget habla con el MISMO cerebro del bot vía el endpoint público
 * `/api/chat/web` del chatbot (canal 'web').
 */
export const CHAT = {
  /** Encendido por defecto; `PUBLIC_ENABLE_WEB_CHAT=false` lo apaga (no se renderiza). */
  enabled: import.meta.env.PUBLIC_ENABLE_WEB_CHAT !== 'false',
  /** Endpoint del bot. Default: subdominio de producción del chatbot. */
  apiUrl:
    import.meta.env.PUBLIC_CHATBOT_API_URL ??
    'https://bot.ci-quality-group.com/api/chat/web',
} as const;
