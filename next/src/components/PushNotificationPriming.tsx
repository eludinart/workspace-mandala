'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'

const DISMISS_KEY = 'mdl_push_priming_dismissed'

/**
 * Propose les notifications navigateur (PWA / mobile web).
 * Les push FCM natives (Android/iOS) seront branchées sur le même flux plus tard.
 */
export function PushNotificationPriming() {
  const { user } = useAuth()
  const userId = user && (user as { id?: string | number }).id != null ? String((user as { id: string | number }).id) : null
  const [open, setOpen] = useState(false)

  const evaluateOpen = useCallback(() => {
    if (!userId || typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    const loginKey = `push_just_logged_in_${userId}`
    if (sessionStorage.getItem(loginKey) === '1') {
      sessionStorage.removeItem(loginKey)
      setOpen(true)
      return
    }
    setOpen(true)
  }, [userId])

  useEffect(() => {
    evaluateOpen()
  }, [evaluateOpen])

  const onAccept = async () => {
    setOpen(false)
    try {
      await Notification.requestPermission()
    } catch {
      /* ignore */
    }
  }

  const onLater = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  return createPortal(
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
              Restez informé sur mobile
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Activez les notifications pour recevoir les messages, annonces et rappels d&apos;événements même
              quand l&apos;app est en arrière-plan.
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Vous pourrez modifier ce choix dans les réglages du navigateur ou du téléphone.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => void onAccept()}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500"
          >
            Activer les notifications
          </button>
          <button
            type="button"
            onClick={onLater}
            className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-800"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
