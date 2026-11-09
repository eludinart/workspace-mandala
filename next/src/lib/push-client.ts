/**
 * Client push : VAPID (iOS PWA) + token FCM natif (Play TWA) + FCM web (Chrome).
 */
import { notificationsApi } from '@/api/notifications'
import { isIosDevice, isStandaloneDisplay } from '@/lib/pwa-install'
import { platformFromUserAgent } from '@/lib/push-platform'

const NATIVE_FCM_PARAM = 'fcm_token'
const NATIVE_FCM_STORAGE = 'mdl_native_fcm_token'

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

/** iPhone / iPad ouvert dans Safari : le push n’existe qu’après « Sur l’écran d’accueil ». */
export function needsIosHomeScreenForPush(): boolean {
  return isIosDevice() && !isStandaloneDisplay()
}

export const IOS_PUSH_HOME_SCREEN_HINT =
  'Touchez Partager, puis Sur l’écran d’accueil, puis rouvrez Mandala depuis cette icône.'

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
    let hasNative = false
    try {
      hasNative = !!(localStorage.getItem(NATIVE_FCM_STORAGE) || '').trim()
    } catch {
      hasNative = false
    }
    const hasSubscription = !!subscription || hasNative
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** L'abonnement a été créé avec une autre clé : il sera refusé (403) tant qu'on ne le refait pas. */
function subscriptionKeyMismatch(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options?.applicationServerKey
  if (!current) return false
  const existing = bytesToBase64Url(new Uint8Array(current))
  const expected = publicKey.trim().replace(/=+$/g, '')
  return existing !== expected
}

async function registerNativeFcmToken(token: string): Promise<boolean> {
  const clean = token.trim()
  if (!clean || clean.length < 20) return false
  try {
    await notificationsApi.registerPushSubscription({
      endpoint: clean,
      keys: { p256dh: 'fcm', auth: 'native' },
      platform: 'android',
      standalone: true,
      provider: 'fcm',
    })
    try {
      localStorage.setItem(NATIVE_FCM_STORAGE, clean)
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}

/** Lit `?fcm_token=` injecté par la TWA Play, enregistre, nettoie l’URL. */
export async function syncNativeFcmTokenFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get(NATIVE_FCM_PARAM)?.trim() || ''
  let token = fromQuery
  if (!token) {
    try {
      token = localStorage.getItem(NATIVE_FCM_STORAGE)?.trim() || ''
    } catch {
      token = ''
    }
  }
  if (!token) return false

  const ok = await registerNativeFcmToken(token)
  if (fromQuery) {
    url.searchParams.delete(NATIVE_FCM_PARAM)
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, '', next)
  }
  return ok
}

function firebaseWebConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()
  )
}

/** FCM Web (Chrome / desktop) — iOS reste sur VAPID. */
async function tryRegisterFcmWeb(): Promise<boolean> {
  if (isIosDevice() || !firebaseWebConfigured() || !isPushClientSupported()) return false
  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
    if (!(await isSupported())) return false
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    }
    const app = getApps().length ? getApps()[0]! : initializeApp(config)
    await registerMandalaServiceWorker()
    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: (await navigator.serviceWorker.getRegistration('/')) || undefined,
    })
    if (!token) return false
    const ua = navigator.userAgent
    await notificationsApi.registerPushSubscription({
      endpoint: token,
      keys: { p256dh: 'fcm', auth: 'web' },
      platform: platformFromUserAgent(ua),
      standalone: isStandaloneDisplay(),
      provider: 'fcm_web',
    })
    return true
  } catch (err) {
    console.warn('[push] fcm web register failed', err)
    return false
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

  const nativeOk = await syncNativeFcmTokenFromUrl()
  // Play TWA : token natif prioritaire — pas besoin de double abonnement VAPID.
  if (nativeOk) {
    return { ok: true, permission }
  }

  if (await tryRegisterFcmWeb()) {
    return { ok: true, permission }
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
  if (subscription && subscriptionKeyMismatch(subscription, publicKey)) {
    await subscription.unsubscribe().catch(() => {})
    subscription = null
  }
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
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    await notificationsApi.registerPushSubscription({
      endpoint,
      keys: { p256dh, auth },
      platform: platformFromUserAgent(ua),
      standalone: isStandaloneDisplay(),
      provider: 'web_push',
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
      await syncNativeFcmTokenFromUrl()
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
