/** Helpers compartidos para las rutas del panel. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * ¿Es un UUID válido? Los params de query (?id=, ?sourceId=) llegan como texto libre
 * y, si se pasan crudos a una columna uuid de Postgres, lanzan "invalid input syntax
 * for type uuid" → 500 sin formato. Validar antes permite responder un 400 limpio.
 */
export function isUuid(v: string | null | undefined): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}
