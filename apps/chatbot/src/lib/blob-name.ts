/**
 * Convierte un nombre de archivo en una ruta SEGURA para Vercel Blob: sin acentos,
 * espacios ni paréntesis. En la subida de cliente, el pathname viaja en el query
 * `?pathname=...` (donde los espacios se codifican como `+` y `()` como `%28%29`) y
 * debe coincidir EXACTO con el pathname firmado en el token; cualquier ambigüedad de
 * codificación provoca un 400 del Blob API (que el navegador reporta como CORS).
 * Saneando a un slug ASCII se elimina toda esa clase de error. El sufijo aleatorio
 * del token mantiene la unicidad; el nombre legible del archivo se guarda aparte.
 */
export function safeBlobName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const base =
    (dot > 0 ? filename.slice(0, dot) : filename)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quitar acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'archivo'
  return ext ? `${base}.${ext}` : base
}
