import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * Guard anti-SSRF para la ingesta de URLs (el admin pega un enlace y el servidor lo
 * descarga). Sin esto, una URL hacia `169.254.169.254` o una IP privada haría que el
 * servidor pidiera recursos internos/de metadata y devolviera el cuerpo. Se valida el
 * esquema, el host y TODAS las IPs resueltas (DNS), bloqueando rangos privados/reservados.
 */

function ipv4Blocked(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true // raro → bloquear
  const [a, b] = p
  if (a === 0 || a === 10 || a === 127) return true // 0/8, 10/8, 127/8
  if (a === 169 && b === 254) return true // 169.254/16 (link-local + metadata cloud)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 (CGNAT)
  if (a === 192 && b === 0 && p[2] === 0) return true // 192.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18/15 (benchmark)
  if (a >= 224) return true // multicast/reservado 224.0.0.0+
  return false
}

function ipBlocked(ip: string): boolean {
  const fam = net.isIP(ip)
  if (fam === 4) return ipv4Blocked(ip)
  if (fam === 6) {
    const low = ip.toLowerCase()
    if (low === '::1' || low === '::') return true // loopback / unspecified
    if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true // link-local / ULA
    // IPv4 mapeada (::ffff:1.2.3.4) → validar la parte v4.
    const m = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (m) return ipv4Blocked(m[1])
    return false
  }
  return true // no es IP válida → bloquear
}

/** Lanza si la URL no es http(s) pública (host o cualquier IP resuelta es interna). */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('URL inválida.')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Solo se permiten enlaces http(s).')
  }
  const host = u.hostname.replace(/^\[|\]$/g, '') // quitar corchetes de IPv6
  if (/^(localhost|.*\.local|.*\.internal|metadata.*)$/i.test(host)) {
    throw new Error('El enlace apunta a un host no permitido.')
  }
  const addrs = net.isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error('No se pudo resolver el dominio del enlace.')
      })
  if (addrs.length === 0 || addrs.some((a) => ipBlocked(a.address))) {
    throw new Error('El enlace apunta a una red interna y no se puede ingerir.')
  }
  return u
}
