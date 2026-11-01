/**
 * Détection du contexte de distribution Google Play (TWA / app store)
 * pour interdire tout checkout Stripe in-app (politique Play Billing).
 *
 * Sur navigateur desktop / mobile Chrome classique → surface `web` (Stripe OK).
 */
import { isAndroidDevice, isStandaloneDisplay } from '@/lib/pwa-install'
import { isPlayBillingAvailable } from '@/lib/play-billing-client'

export type PaymentSurface = 'web' | 'play'

const DIST_STORAGE_KEY = 'mdl_payment_dist'
const PLAY_QUERY_KEYS = ['dist', 'utm_source', 'source'] as const
const PLAY_QUERY_VALUES = new Set(['play', 'google-play', 'google_play', 'twa'])

function readQueryPlayHint(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    for (const key of PLAY_QUERY_KEYS) {
      const raw = (params.get(key) || '').trim().toLowerCase()
      if (PLAY_QUERY_VALUES.has(raw)) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function persistPlayHint(): void {
  try {
    sessionStorage.setItem(DIST_STORAGE_KEY, 'play')
  } catch {
    /* ignore */
  }
}

function readPersistedPlayHint(): boolean {
  try {
    return sessionStorage.getItem(DIST_STORAGE_KEY) === 'play'
  } catch {
    return false
  }
}

/** Referrer lancé depuis une app Android (souvent TWA / Play). */
export function hasAndroidAppReferrer(): boolean {
  if (typeof document === 'undefined') return false
  const ref = (document.referrer || '').trim().toLowerCase()
  return ref.startsWith('android-app://')
}

/**
 * Indique si l’UI doit se comporter comme une app Play (pas de Stripe Checkout).
 * Combine : query/session, Digital Goods, referrer android-app, Android standalone.
 */
export async function resolvePaymentSurface(): Promise<PaymentSurface> {
  if (typeof window === 'undefined') return 'web'

  if (readQueryPlayHint()) {
    persistPlayHint()
    return 'play'
  }
  if (readPersistedPlayHint()) return 'play'
  if (hasAndroidAppReferrer()) {
    persistPlayHint()
    return 'play'
  }

  try {
    if (await isPlayBillingAvailable()) {
      persistPlayHint()
      return 'play'
    }
  } catch {
    /* ignore */
  }

  // TWA et PWA installée Android : standalone sans barre d’URL.
  // On bloque Stripe par prudence (revue Play) ; le web desktop reste Stripe.
  if (isAndroidDevice() && isStandaloneDisplay()) {
    persistPlayHint()
    return 'play'
  }

  return 'web'
}

export function paymentSurfaceAllowsStripe(surface: PaymentSurface): boolean {
  return surface === 'web'
}
