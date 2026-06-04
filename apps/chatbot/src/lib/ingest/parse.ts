import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { parseOffice } from 'officeparser'

/**
 * Extrae texto plano de un documento (blueprint §9 Step 5).
 * Tipos soportados: pdf | docx | pptx | txt.
 */
export type ParseableType = 'pdf' | 'docx' | 'pptx' | 'txt'

export async function parseDocument(buffer: Buffer, type: ParseableType): Promise<string> {
  switch (type) {
    case 'pdf': {
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        return normalize(result.text)
      } finally {
        await parser.destroy()
      }
    }
    case 'docx': {
      const { value } = await mammoth.extractRawText({ buffer })
      return normalize(value)
    }
    case 'pptx': {
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
