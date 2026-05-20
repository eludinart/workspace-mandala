import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe, updateProfile } from '@/lib/db-auth'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const user = await authMe(parseInt(userId, 10))
    return NextResponse.json(user)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Non autorisé' },
      { status: e.status || 401 }
    )
  }
}

function profileJsonResponse(user: Awaited<ReturnType<typeof updateProfile>>) {
  // Ne pas renvoyer le base64 dans la réponse POST (souvent > 500 Ko → échec client / 500).
  const { avatar: _a, ...rest } = user as Record<string, unknown> & { avatar?: string | null }
  return NextResponse.json({
    ...rest,
    has_avatar: !!(user.avatar && String(user.avatar).length > 0),
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Corps de requête invalide ou trop volumineux (réduisez la taille de la photo)' },
        { status: 413 }
      )
    }
    const user = await updateProfile(parseInt(userId, 10), body)
    return profileJsonResponse(user)
  } catch (err: unknown) {
    console.error('[POST /api/account/profile]', err)
    const e = err as { status?: number; message?: string }
    const message = e.message || (err instanceof Error ? err.message : 'Erreur serveur')
    const status =
      typeof e.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 400
    return NextResponse.json({ error: message }, { status })
  }
}
