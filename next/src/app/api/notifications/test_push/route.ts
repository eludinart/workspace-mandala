import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { createNotification, invalidateNotifUnreadCache } from '@/lib/db-notifications'
import { countPushSubscriptionsForUser } from '@/lib/db-push'
import { isWebPushConfigured, sendWebPushToUser } from '@/lib/web-push-send'

export const dynamic = 'force-dynamic'

/** Envoie une notification de test (cloche in-app + push appareil). */
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

    const title = 'Mandala — test'
    const body =
      'Si vous voyez ceci, les notifications push fonctionnent sur cet appareil.'
    const actionUrl = '/app?page=notifications'

    // Entrée cloche / sous-menu (+ push via createNotification)
    const created = await createNotification({
      type: 'system',
      title,
      body,
      action_url: actionUrl,
      recipient_type: 'user',
      recipient_id: uid,
      priority: 'normal',
      created_by: uid,
    })
    invalidateNotifUnreadCache(uid)

    // Si dédoublonnage (double-clic < 20s), createNotification n'a pas renvoyé de push
    const pushResult = created.deduplicated
      ? await sendWebPushToUser(uid, title, body, actionUrl)
      : { sent: devices, gone: 0, errors: 0 }

    return NextResponse.json({
      ok: true,
      devices,
      in_app: true,
      notification_id: created.notification_id,
      ...pushResult,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    console.error('[notifications/test_push]', e.message ?? err)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
