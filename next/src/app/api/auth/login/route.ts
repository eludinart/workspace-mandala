import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authLogin } from '@/lib/db-auth'
import { formatDbConnectionError } from '@/lib/db-errors'
import { jwtEncode } from '@/lib/jwt'
import { setAuthCookie } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }
    const body = await req.json()
    const login = (body.login || body.email || '').trim()
    const password = body.password || ''
    if (!login || !password) {
      return NextResponse.json(
        { error: 'Identifiant et mot de passe requis' },
        { status: 400 }
      )
    }
    const user = await authLogin(login, password)
    const token = jwtEncode({
      sub: String(user.id),
      role: user.app_role || 'user',
      email: user.email || '',
    })
    const res = NextResponse.json({ token, user })
    setAuthCookie(res, token)
    return res
  } catch (err: unknown) {
    const e = err as Error & { status?: number; code?: string }
    const isDb =
      e.code === 'ECONNREFUSED' ||
      e.code === 'ETIMEDOUT' ||
      e.code === 'PROTOCOL_CONNECTION_LOST' ||
      String(e.message ?? '').includes('ECONNREFUSED')
    const status = isDb ? 503 : e.status || 401
    const message = isDb
      ? formatDbConnectionError(err)
      : e.message || 'Identifiant ou mot de passe incorrect'
    return NextResponse.json({ error: message }, { status })
  }
}
