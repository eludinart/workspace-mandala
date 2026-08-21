/**
 * Rate limit mémoire (par process). Suffisant pour freiner brute-force
 * derrière un reverse-proxy ; pas partagé entre réplicas.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimitAllow(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }
  return { ok: true, retryAfterSec: 0 }
}

export function clientIpFromRequest(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (fwd) return fwd
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}
