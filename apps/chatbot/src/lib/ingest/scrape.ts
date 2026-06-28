import { assertPublicHttpUrl } from './ssrf'

const MAX_REDIRECTS = 4
const FETCH_TIMEOUT_MS = 12_000

/**
 * Extrae texto legible de una URL (blueprint §9 Step 5).
 * Implementación ligera sin dependencias: descarga el HTML y limpia
 * scripts/estilos/etiquetas. Anti-SSRF: se valida la URL y CADA salto de redirección
 * contra rangos internos/metadata (las redirecciones se siguen a mano para revalidar).
 */
export async function scrapeUrl(url: string): Promise<string> {
  let current = url
  let res: Response | null = null

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHttpUrl(current) // valida esquema + IPs resueltas en cada salto
    res = await fetch(current, {
      headers: { 'user-agent': 'CIQualityGroupBot/1.0 (+ingesta de conocimiento)' },
      redirect: 'manual', // seguimos a mano para revalidar el destino
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) break
      current = new URL(loc, current).toString()
      continue
    }
    break
  }

  if (!res || !res.ok) {
    throw new Error(`No se pudo descargar el enlace: HTTP ${res?.status ?? '???'}`)
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
