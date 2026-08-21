import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { deletePushSubscriptionForUser } from '@/lib/db-push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) throw new ApiError(401, 'Authentification requise')

    const body = (await req.json().catch(() => ({}))) as { endpoint?: string }
    const endpoint = String(body.endpoint ?? '').trim()
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint requis' }, { status: 400 })
    }

    await deletePushSubscriptionForUser(uid, endpoint)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
