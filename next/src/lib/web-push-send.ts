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

export type WebPushOptions = {
  /** `high` réveille l'appareil (Android / Samsung). `normal` peut attendre que Chrome s'ouvre. */
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
  /** Même sujet = le dernier message remplace celui encore en file, et réveille quand même. */
  tag?: string
}

function pushTopic(tag: string | undefined): string | undefined {
  if (!tag) return undefined
  const topic = tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
  return topic || undefined
}

async function sendToSubscription(
  sub: PushSubscriptionRow,
  title: string,
  body: string,
  webPath: string,
  options?: WebPushOptions
): Promise<'ok' | 'gone' | 'error'> {
  const urgency = options?.urgency ?? 'normal'
  const tag = options?.tag
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
        ...(tag ? { tag, renotify: true } : {}),
      }),
      {
        TTL: 60 * 60 * 12,
        urgency,
        ...(pushTopic(tag) ? { topic: pushTopic(tag) } : {}),
      }
    )
    return 'ok'
  } catch (err: unknown) {
    const statusCode = Number((err as { statusCode?: number })?.statusCode ?? 0)
    const detail = String((err as { body?: string })?.body || (err as Error)?.message || '').slice(0, 180)
    // 404/410 : appareil désinscrit. 403 : clé refusée, cet abonnement ne marchera plus.
    if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
      await deletePushSubscriptionById(sub.id).catch(() => {})
      console.error('[web-push] subscription removed', statusCode, detail)
      return 'gone'
    }
    console.error('[web-push] send failed', statusCode || '', detail)
    return 'error'
  }
}

/** Envoie une push à tous les appareils enregistrés pour un utilisateur. */
export async function sendWebPushToUser(
  userId: number,
  title: string,
  body: string,
  actionUrl?: string | null,
  options?: WebPushOptions
): Promise<{ sent: number; gone: number; errors: number }> {
  if (!ensureVapid()) {
    return { sent: 0, gone: 0, errors: 0 }
  }
  let subs: PushSubscriptionRow[]
  try {
    subs = await listPushSubscriptionsForUser(userId)
  } catch (err: unknown) {
    console.error('[web-push] list failed', userId, (err as Error)?.message ?? err)
    return { sent: 0, gone: 0, errors: 1 }
  }
  if (!subs.length) return { sent: 0, gone: 0, errors: 0 }

  const webPath = actionUrlToWebPath(actionUrl)
  let sent = 0
  let gone = 0
  let errors = 0
  for (const sub of subs) {
    const result = await sendToSubscription(sub, title, body, webPath, options)
    if (result === 'ok') sent += 1
    else if (result === 'gone') gone += 1
    else errors += 1
  }
  return { sent, gone, errors }
}

const PUSH_FANOUT_CONCURRENCY = 4

/**
 * Envoie la même push à plusieurs comptes, peu à peu.
 * Le pool MariaDB refuse au-delà d'une courte file : un envoi massif en parallèle
 * perd des destinataires sans erreur visible.
 */
export async function sendWebPushToUsers(
  userIds: number[],
  title: string,
  body: string,
  actionUrl?: string | null,
  options?: WebPushOptions
): Promise<{ sent: number; gone: number; errors: number; users: number }> {
  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))]
  const acc = { sent: 0, gone: 0, errors: 0, users: unique.length }
  if (!ensureVapid() || unique.length === 0) return acc

  let cursor = 0
  async function worker() {
    while (cursor < unique.length) {
      const userId = unique[cursor]
      cursor += 1
      const result = await sendWebPushToUser(userId, title, body, actionUrl, options)
      acc.sent += result.sent
      acc.gone += result.gone
      acc.errors += result.errors
    }
  }

  const workers = Math.min(PUSH_FANOUT_CONCURRENCY, unique.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return acc
}
