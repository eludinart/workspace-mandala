import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authRegister } from '@/lib/db-auth'
import { joinCommunity } from '@/lib/db-communities'
import { jwtEncode } from '@/lib/jwt'
import { setAuthCookie } from '@/lib/auth-cookie'
import { clientIpFromRequest, rateLimitAllow } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req.headers)
    const limited = rateLimitAllow(`auth-register:${ip}`, 8, 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      )
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }
    const body = await req.json()
    const email = (body.email || '').trim()
    const password = body.password || ''
    const firstName = (body.first_name || '').trim()
    const lastName = (body.last_name || '').trim()
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Prénom et nom de famille requis' },
        { status: 400 }
      )
    }
    const user = await authRegister(email, password, firstName, lastName)

    const communitySlug = String(body.community_slug ?? '').trim().toLowerCase()
    const inviteCode =
      body.invite_code != null
        ? String(body.invite_code)
        : body.invite_token != null
          ? String(body.invite_token)
          : null
    if (communitySlug) {
      await joinCommunity({
        userId: user.id,
        slug: communitySlug,
        inviteCode,
      })
    }

    const token = jwtEncode({
      sub: String(user.id),
      role: user.app_role || 'user',
      email: user.email || '',
    })
    const res = NextResponse.json({ token, user })
    setAuthCookie(res, token)
    return res
  } catch (err: unknown) {
    const e = err as Error
    const status = (e as Error & { status?: number }).status || 400
    return NextResponse.json(
      { error: e.message || "Erreur lors de l'inscription" },
      { status }
    )
  }
}
