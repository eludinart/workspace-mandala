'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  enablePushNotifications,
  getPushDeviceStatus,
  syncPushSubscriptionIfGranted,
  type PushDeviceStatus,
} from '@/lib/push-client'

/** Report « Plus tard » : 3 jours (pas définitif). */
const SNOOZE_KEY = 'mdl_push_prompt_snooze_until'
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000
/** Bannière : report session (jusqu’à fermeture de l’onglet). */
const SESSION_HIDE_KEY = 'mdl_push_banner_hidden'

function isSnoozed(): boolean {
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

function snoozePrompt(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  } catch {
    /* ignore */
  }
}

function isBannerHiddenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_HIDE_KEY) === '1'
  } catch {
    return false
  }
}

function hideBannerThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_HIDE_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Propose d’activer les notifications tant qu’elles ne sont pas actives sur l’appareil :
 * modal (première invitation) + bannière persistante.
 */
export function PushNotificationPriming() {
  const { user } = useAuth()
  const userId =
    user && (user as { id?: string | number }).id != null
      ? String((user as { id: string | number }).id)
      : null

  const [status, setStatus] = useState<PushDeviceStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    if (!userId || typeof window === 'undefined') {
      setStatus(null)
      setModalOpen(false)
      setBannerVisible(false)
      return
    }
    // Ne pas attendre le sync API ici (évite « Queue limit reached » au montage / Strict Mode).
    const next = await getPushDeviceStatus()
    setStatus(next)

    if (!next.supported || next.active) {
      setModalOpen(false)
      setBannerVisible(false)
      if (next.active) void syncPushSubscriptionIfGranted()
      return
    }

    const snoozed = isSnoozed()
    const sessionHidden = isBannerHiddenThisSession()

    setBannerVisible(!sessionHidden)

    if (next.permission === 'default' && !snoozed) {
      setModalOpen(true)
    } else {
      setModalOpen(false)
    }
  }, [userId])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshStatus()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, refreshStatus])

  const onActivate = async () => {
    setBusy(true)
    setHint(null)
    try {
      if (status?.permission === 'denied') {
        setHint(
          'Les notifications sont bloquées dans le navigateur. Autorisez-les dans les réglages du site, puis réessayez.'
        )
        return
      }
      const result = await enablePushNotifications()
      if (result.ok) {
        setModalOpen(false)
        setBannerVisible(false)
        setHint(null)
        await refreshStatus()
        return
      }
      if (result.reason === 'denied') {
        setHint(
          'Permission refusée. Vous pourrez l’activer plus tard dans Compte → Préférences alertes, ou dans les réglages du navigateur.'
        )
        snoozePrompt()
        setModalOpen(false)
      } else if (result.reason === 'no_vapid_key') {
        setHint('Configuration push incomplète côté serveur. Réessayez après le déploiement.')
      } else if (result.reason === 'unsupported') {
        setHint(
          'Cet appareil ne prend pas en charge les push web. Sur iPhone : ajoutez Mandala à l’écran d’accueil.'
        )
      } else {
        setHint('Impossible d’activer les notifications pour le moment.')
      }
      await refreshStatus()
    } catch {
      setHint('Erreur lors de l’activation.')
    } finally {
      setBusy(false)
    }
  }

  const onLater = () => {
    snoozePrompt()
    setModalOpen(false)
  }

  const onDismissBanner = () => {
    hideBannerThisSession()
    setBannerVisible(false)
  }

  if (!userId || !status || status.active || !status.supported) {
    return null
  }

  const canRequest = status.permission !== 'denied'

  return (
    <>
      {bannerVisible && (
        <div
          className="shrink-0 border-b border-violet-700/40 bg-violet-950/40 px-3 py-2.5 sm:px-4"
          role="region"
          aria-label="Activer les notifications"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <p className="flex-1 min-w-0 text-sm text-violet-100">
              <span className="font-medium">Notifications désactivées</span>
              <span className="text-violet-200/90">
                {' '}
                — activez-les sur cet appareil pour être prévenu des nouveaux messages.
              </span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {canRequest ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onActivate()}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
                >
                  {busy ? '…' : 'Activer'}
                </button>
              ) : (
                <span className="text-[11px] text-amber-200/90 max-w-[14rem]">
                  Autorisez Mandala dans les réglages du navigateur.
                </span>
              )}
              <button
                type="button"
                onClick={onDismissBanner}
                className="px-2 py-1.5 rounded-lg text-violet-300 hover:text-white text-xs hover:bg-violet-900/50"
                aria-label="Masquer pour cette session"
              >
                Masquer
              </button>
            </div>
          </div>
          {hint && <p className="mt-1.5 text-[11px] text-violet-200/90">{hint}</p>}
        </div>
      )}

      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-priming-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5 space-y-4 mb-[env(safe-area-inset-bottom)]">
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0" aria-hidden>
                  🔔
                </span>
                <div className="min-w-0">
                  <h2 id="push-priming-title" className="text-lg font-semibold text-slate-100">
                    Activer les notifications
                  </h2>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Elles ne sont pas encore actives sur cet appareil. Activez-les pour recevoir les
                    messages et alertes même lorsque Mandala est en arrière-plan.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Sur iPhone : ajoutez d&apos;abord Mandala à l&apos;écran d&apos;accueil, puis activez
                les notifications.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onActivate()}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
                >
                  {busy ? 'Activation…' : 'Activer sur cet appareil'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onLater}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
