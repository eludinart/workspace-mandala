import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { countPushSubscriptionsForUser } from '@/lib/db-push'
import { isWebPushConfigured, sendWebPushToUser } from '@/lib/web-push-send'

export const dynamic = 'force-dynamic'

/** Envoie une notification de test à l’utilisateur connecté. */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) throw new ApiError(401, 'Authentification requise')

    if (!isWebPushConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Web Push non configuré (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY)',
        },
        { status: 503 }
      )
    }

    const devices = await countPushSubscriptionsForUser(uid)
    if (!devices) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Aucun abonnement push enregistré pour ce compte. Activez les notifications sur cet appareil.',
          devices: 0,
        },
        { status: 400 }
      )
    }

    const result = await sendWebPushToUser(
      uid,
      'Mandala — test',
      'Si vous voyez ceci, les notifications push fonctionnent sur cet appareil.',
      '/app?page=notifications'
    )

    return NextResponse.json({
      ok: result.sent > 0,
      devices,
      ...result,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    console.error('[notifications/test_push]', e.message ?? err)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
