/**
 * Extrae texto plano de un documento (blueprint §9 Step 5).
 * Tipos soportados: pdf | docx | pptx | txt.
 *
 * Los parsers (pdf-parse → @napi-rs/canvas, mammoth, officeparser) traen
 * dependencias NATIVAS. Importarlos a nivel de módulo hacía que /api/inngest
 * fallara al *registrar* las funciones (el binding nativo revienta al cargar
 * en el lambda de Vercel). Por eso se cargan con import() diferido DENTRO de
 * cada caso: solo se tocan cuando el job realmente parsea ese tipo de archivo.
 */
export type ParseableType = 'pdf' | 'docx' | 'pptx' | 'txt'

export async function parseDocument(buffer: Buffer, type: ParseableType): Promise<string> {
  switch (type) {
    case 'pdf': {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        return normalize(result.text)
      } finally {
        await parser.destroy()
      }
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
