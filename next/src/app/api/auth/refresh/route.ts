import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe, userAccountExists } from '@/lib/db-auth'
import { jwtDecodeForRefresh, jwtEncode } from '@/lib/jwt'
import { getAuthHeader } from '@/lib/api-auth'
import { setAuthCookie } from '@/lib/auth-cookie'
import { clientIpFromRequest, rateLimitAllow } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req.headers)
    const limited = rateLimitAllow(`auth-refresh:${ip}`, 60, 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      )
    }

    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    const payload = jwtDecodeForRefresh(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Token invalide ou expirée trop longtemps' }, { status: 401 })
    }

    const userId = parseInt(payload.sub, 10)
    if (!userId || Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const exists = await userAccountExists(userId)
    if (!exists) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 401 })
    }

    let role = payload.role || 'user'
    let email = payload.email || ''
    try {
      const user = await authMe(userId)
      role = user.app_role || role
      email = user.email || email
    } catch {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 401 })
    }

    const newToken = jwtEncode({ sub: payload.sub, role, email })
    const res = NextResponse.json({ token: newToken })
    setAuthCookie(res, newToken)
    return res
  } catch {
    return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
  }
}
