/**
 * Extrae texto plano de un documento (blueprint §9 Step 5).
 * Tipos soportados: pdf | docx | pptx | txt.
 *
 * PDF: usamos `unpdf` (build de pdf.js para Node/serverless, SIN deps nativas
 * ni globals de navegador). `pdf-parse` no sirve aquí: por dentro usa pdf.js que
 * espera `DOMMatrix` y compañía → en el lambda lanza "DOMMatrix is not defined",
 * y su polyfill natural (`@napi-rs/canvas`) es justo el binario nativo que no
 * carga en Vercel.
 *
 * DOCX/PPTX (mammoth, officeparser) se cargan con import() diferido DENTRO de
 * cada caso: así registrar el endpoint /api/inngest no toca esos módulos; solo
 * se importan cuando el job realmente parsea ese tipo de archivo.
 */
export type ParseableType = 'pdf' | 'docx' | 'pptx' | 'txt'

export async function parseDocument(buffer: Buffer, type: ParseableType): Promise<string> {
  switch (type) {
    case 'pdf': {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await extractText(pdf, { mergePages: true })
      return normalize(text)
    }
    case 'docx': {
      const { default: mammoth } = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer })
      return normalize(value)
    }
    case 'pptx': {
      const { parseOffice } = await import('officeparser')
      const text = await parseOffice(buffer)
      return normalize(typeof text === 'string' ? text : String(text))
    }
    case 'txt': {
      return normalize(buffer.toString('utf8'))
    }
  }
}

const NBSP = / /g

function normalize(text: string): string {
  return text
    .replace(NBSP, ' ') // espacios duros → espacio normal
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
