import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { resetPasswordWithToken } from '@/lib/db-auth'
import { formatDbConnectionError } from '@/lib/db-errors'
import { jwtEncode } from '@/lib/jwt'
import { setAuthCookie } from '@/lib/auth-cookie'
import { clientIpFromRequest, rateLimitAllow } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function isDbError(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return (
    e.code === 'ECONNREFUSED' ||
    e.code === 'ETIMEDOUT' ||
    e.code === 'PROTOCOL_CONNECTION_LOST' ||
    String(e.message ?? '').includes('ECONNREFUSED')
  )
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req.headers)
    const limited = rateLimitAllow(`auth-reset:${ip}`, 10, 15 * 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      )
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const token = String(body.token ?? '')
    const password = String(body.password ?? '')
    if (!token || !password) {
      return NextResponse.json({ error: 'Lien et nouveau mot de passe requis' }, { status: 400 })
    }

    const user = await resetPasswordWithToken(token, password)
    const jwt = jwtEncode({
      sub: String(user.id),
      role: user.app_role || 'user',
      email: user.email || '',
    })
    const res = NextResponse.json({ token: jwt, user })
    setAuthCookie(res, jwt)
    return res
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = isDbError(err) ? 503 : e.status || 400
    const message = isDbError(err)
      ? formatDbConnectionError(err)
      : e.message || 'Impossible de réinitialiser le mot de passe'
    return NextResponse.json({ error: message }, { status })
  }
}
