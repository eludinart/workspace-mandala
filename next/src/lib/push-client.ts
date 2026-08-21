/**
 * Client Web Push : enregistrement du service worker + abonnement VAPID.
 */
import { notificationsApi } from '@/api/notifications'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushClientSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export type PushDeviceStatus = {
  supported: boolean
  /** Permission navigateur + abonnement PushManager présent */
  active: boolean
  permission: NotificationPermission | 'unsupported'
  hasSubscription: boolean
}

/** Indique si les notifications push sont réellement actives sur cet appareil. */
export async function getPushDeviceStatus(): Promise<PushDeviceStatus> {
  if (!isPushClientSupported()) {
    return {
      supported: false,
      active: false,
      permission: 'unsupported',
      hasSubscription: false,
    }
  }
  const permission = Notification.permission
  if (permission !== 'granted') {
    return { supported: true, active: false, permission, hasSubscription: false }
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = registration ? await registration.pushManager.getSubscription() : null
    const hasSubscription = !!subscription
    return {
      supported: true,
      active: hasSubscription,
      permission,
      hasSubscription,
    }
  } catch {
    return { supported: true, active: false, permission, hasSubscription: false }
  }
}

export async function registerMandalaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushClientSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.warn('[push] service worker register failed', err)
    return null
  }
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (fromEnv) return fromEnv
  try {
    const res = (await notificationsApi.vapidPublicKey()) as {
      publicKey?: string | null
      configured?: boolean
    }
    return res.publicKey?.trim() || null
  } catch {
    return null
  }
}

/** Demande la permission (si besoin), s’abonne et enregistre l’endpoint côté serveur. */
export async function enablePushNotifications(): Promise<{
  ok: boolean
  reason?: string
  permission?: NotificationPermission
}> {
  if (!isPushClientSupported()) {
    return { ok: false, reason: 'unsupported' }
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied', permission }
  }

  const publicKey = await fetchVapidPublicKey()
  if (!publicKey) {
    return { ok: false, reason: 'no_vapid_key', permission }
  }

  const registration = await registerMandalaServiceWorker()
  if (!registration) {
    return { ok: false, reason: 'sw_failed', permission }
  }

  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, reason: 'subscribe_incomplete', permission }
  }

  try {
    await notificationsApi.registerPushSubscription({
      endpoint,
      keys: { p256dh, auth },
    })
  } catch {
    return { ok: false, reason: 'register_failed', permission }
  }

  return { ok: true, permission }
}

/** Si la permission est déjà accordée, resynchronise l’abonnement (après login). */
let syncInFlight: Promise<void> | null = null
let lastSyncAt = 0
const SYNC_COOLDOWN_MS = 60_000

export async function syncPushSubscriptionIfGranted(): Promise<void> {
  if (!isPushClientSupported()) return
  if (Notification.permission !== 'granted') return
  if (Date.now() - lastSyncAt < SYNC_COOLDOWN_MS) return
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    try {
      await enablePushNotifications()
      lastSyncAt = Date.now()
    } catch {
      /* ex. file d’attente MariaDB saturée — non bloquant */
    } finally {
      syncInFlight = null
    }
  })()

  return syncInFlight
}
