/**
 * Red de seguridad de formato (complementa la regla 10 del system prompt).
 * El prompt prohíbe markdown real, pero el modelo a veces se resbala e igual
 * mete negrita o encabezados con almohadilla. En WhatsApp/Messenger eso se ve
 * como asteriscos/gatos literales — se ve poco profesional. Función pura
 * para poder testearla sin depender de OpenAI/DB.
 */
export function stripStrayMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '') // encabezados markdown al inicio de línea
    .replace(/\*\*([^*\n]+)\*\*/g, '$1') // **negrita**
    .replace(/__([^_\n]+)__/g, '$1') // __negrita__
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2') // *cursiva* (un asterisco)
    .replace(/(^|[^\w_])_([^_\n]+)_(?=[^\w_]|$)/g, '$1$2') // _cursiva_
}
