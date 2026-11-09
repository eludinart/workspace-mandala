import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { invalidateNotifUnreadCache, recordUserNotification } from '@/lib/db-notifications'
import { countPushSubscriptionsForUser } from '@/lib/db-push'
import { isWebPushConfigured, sendWebPushToUser } from '@/lib/web-push-send'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId: adminId } = await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { userId?: number }
    const targetId = Number(body.userId)
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 })
    }
    if (!isWebPushConfigured()) {
      return NextResponse.json({ error: 'Web Push non configuré' }, { status: 503 })
    }
    const devices = await countPushSubscriptionsForUser(targetId)
    if (!devices) {
      return NextResponse.json(
        { ok: false, error: 'Aucun abonnement push pour ce compte', devices: 0 },
        { status: 400 }
      )
    }

    const title = 'Mandala — test admin'
    const text = 'Test push ciblé par un administrateur.'
    const actionUrl = '/app?page=notifications'
    const notificationId = await recordUserNotification({
      userId: targetId,
      type: 'system',
      title,
      body: text,
      actionUrl,
      priority: 'high',
      createdBy: parseInt(adminId, 10) || null,
    })
    invalidateNotifUnreadCache(targetId)

    const pushResult = await sendWebPushToUser(targetId, title, text, actionUrl, {
      notificationId,
      criticalIfUndelivered: true,
      urgency: 'high',
    })

    return NextResponse.json({
      ok: true,
      notification_id: notificationId,
      ...pushResult,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
