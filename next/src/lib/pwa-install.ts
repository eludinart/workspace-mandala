/**
 * Invitation à installer Mandala (icône écran d’accueil).
 * Android : beforeinstallprompt + getInstalledRelatedApps.
 * iPhone : guide Safari. Pas de feuille système.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type RelatedApp = { platform?: string; url?: string; id?: string }

const SNOOZE_KEY = 'mdl_pwa_install_snooze_until'
const LATER_MS = 7 * 24 * 60 * 60 * 1000
const ALREADY_MS = 180 * 24 * 60 * 60 * 1000

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installedThisSession = false
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent || '')
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

function isIosSafari(): boolean {
  if (!isIosDevice()) return false
  const ua = navigator.userAgent || ''
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|FBAN|FBAV|Instagram/i.test(ua)) return false
  return /Safari/i.test(ua)
}

export function isInstallSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY)
    if (!raw) return false
    const until = Number(raw)
    if (!Number.isFinite(until)) return false
    if (Date.now() < until) return true
    localStorage.removeItem(SNOOZE_KEY)
    return false
  } catch {
    return false
  }
}

export function snoozeInstallPrompt(kind: 'later' | 'already'): void {
  try {
    const ms = kind === 'already' ? ALREADY_MS : LATER_MS
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms))
  } catch {
    /* ignore */
  }
  emit()
}

function shouldCaptureInstallPrompt(): boolean {
  return isAndroidDevice() && !isStandaloneDisplay() && !isInstallSnoozed() && !installedThisSession
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!shouldCaptureInstallPrompt()) return
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installedThisSession = true
    deferredPrompt = null
    emit()
  })
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function isRelatedWebAppInstalled(): Promise<boolean> {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<RelatedApp[]>
  }
  if (typeof nav.getInstalledRelatedApps !== 'function') return false
  try {
    const apps = await Promise.race([
      nav.getInstalledRelatedApps(),
      new Promise<RelatedApp[]>((_, reject) => {
        window.setTimeout(() => reject(new Error('timeout')), 1500)
      }),
    ])
    return apps.some((app) => app.platform === 'webapp')
  } catch {
    return false
  }
}

export type InstallOffer = {
  platform: 'ios' | 'android'
  canPrompt: boolean
  iosNeedsSafari: boolean
}

/** À l’ouverture : rien si l’icône est déjà utilisée ou si l’invitation est reportée. */
export async function evaluateInstallOffer(): Promise<InstallOffer | null> {
  if (typeof window === 'undefined') return null
  if (isStandaloneDisplay() || installedThisSession || isInstallSnoozed()) return null

  if (isIosDevice()) {
    return {
      platform: 'ios',
      canPrompt: false,
      iosNeedsSafari: !isIosSafari(),
    }
  }

  if (!isAndroidDevice()) return null
  if (await isRelatedWebAppInstalled()) return null

  return {
    platform: 'android',
    canPrompt: deferredPrompt != null,
    iosNeedsSafari: false,
  }
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  deferredPrompt = null
  try {
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') {
      installedThisSession = true
      emit()
      return 'accepted'
    }
    return 'dismissed'
  } catch {
    return 'unavailable'
  }
}
