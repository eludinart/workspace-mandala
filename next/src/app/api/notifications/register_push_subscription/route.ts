import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { upsertPushSubscription } from '@/lib/db-push'

export const dynamic = 'force-dynamic'

type Body = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  p256dh?: string
  auth?: string
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) throw new ApiError(401, 'Authentification requise')

    const body = (await req.json().catch(() => ({}))) as Body
    const endpoint = String(body.endpoint ?? '').trim()
    const p256dh = String(body.keys?.p256dh ?? body.p256dh ?? '').trim()
    const auth = String(body.keys?.auth ?? body.auth ?? '').trim()
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'endpoint, keys.p256dh et keys.auth requis' },
        { status: 400 }
      )
    }

    await upsertPushSubscription({
      userId: uid,
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    console.error('[notifications/register_push_subscription]', e.message ?? err)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
