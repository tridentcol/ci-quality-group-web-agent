/**
 * Extrae texto legible de una URL (blueprint §9 Step 5).
 * Implementación ligera sin dependencias: descarga el HTML y limpia
 * scripts/estilos/etiquetas. Para casos difíciles puede sustituirse por
 * un lector web más robusto más adelante.
 */
export async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'CIQualityGroupBot/1.0 (+ingesta de conocimiento)' },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`No se pudo descargar ${url}: HTTP ${res.status}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const body = await res.text()

  // Si no es HTML, devolver el texto tal cual (p. ej. text/plain).
  if (!contentType.includes('html')) return clean(body)

  return clean(htmlToText(body))
}

function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function clean(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
