/**
 * Envoi Web Push (VAPID) vers les abonnements stockés en base.
 * Si les clés VAPID manquent, no-op silencieux.
 */
import webpush from 'web-push'
import {
  deletePushSubscriptionById,
  listPushSubscriptionsForUser,
  type PushSubscriptionRow,
} from './db-push'

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@mandala.local'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export function getVapidPublicKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    null
  )
}

export function isWebPushConfigured(): boolean {
  return !!(
    (process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()) &&
    process.env.VAPID_PRIVATE_KEY?.trim()
  )
}

/** Convertit une action_url Mandala en chemin web ouvrant l’app. */
export function actionUrlToWebPath(actionUrl?: string | null): string {
  if (!actionUrl) return '/app?page=notifications'
  const url = String(actionUrl).trim()
  if (!url) return '/app?page=notifications'
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('mandala:')) {
    const rest = url.slice('mandala:'.length)
    const [pagePart, queryPart] = rest.split('?')
    const page = pagePart || 'notifications'
    const params = new URLSearchParams(queryPart ?? '')
    params.set('page', page)
    return `/app?${params.toString()}`
  }
  if (url.startsWith('/')) return url
  return '/app?page=notifications'
}

async function sendToSubscription(
  sub: PushSubscriptionRow,
  title: string,
  body: string,
  webPath: string
): Promise<'ok' | 'gone' | 'error'> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title,
        body,
        url: webPath,
      }),
      { TTL: 60 * 60 * 12, urgency: 'normal' }
    )
    return 'ok'
  } catch (err: unknown) {
    const statusCode = Number((err as { statusCode?: number })?.statusCode ?? 0)
    if (statusCode === 404 || statusCode === 410) {
      await deletePushSubscriptionById(sub.id).catch(() => {})
      return 'gone'
    }
    console.error('[web-push] send failed', statusCode || '', (err as Error)?.message ?? err)
    return 'error'
  }
}

/** Envoie une push à tous les appareils enregistrés pour un utilisateur. */
export async function sendWebPushToUser(
  userId: number,
  title: string,
  body: string,
  actionUrl?: string | null
): Promise<{ sent: number; gone: number; errors: number }> {
  if (!ensureVapid()) {
    return { sent: 0, gone: 0, errors: 0 }
  }
  const subs = await listPushSubscriptionsForUser(userId)
  if (!subs.length) return { sent: 0, gone: 0, errors: 0 }

  const webPath = actionUrlToWebPath(actionUrl)
  let sent = 0
  let gone = 0
  let errors = 0
  for (const sub of subs) {
    const result = await sendToSubscription(sub, title, body, webPath)
    if (result === 'ok') sent += 1
    else if (result === 'gone') gone += 1
    else errors += 1
  }
  return { sent, gone, errors }
}
