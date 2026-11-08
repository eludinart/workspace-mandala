'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'

const TOAST_MS = 6_000

type PushPayload = {
  type?: string
  title?: string
  body?: string
  url?: string
}

type ToastState = {
  id: number
  title: string
  body: string
  url: string
}

const NAV_PAGES: MandalaPage[] = [
  'home',
  'directory',
  'calendar',
  'events',
  'members',
  'messages',
  'skills',
  'resources',
  'notifications',
  'account',
  'charter',
  'places-map',
  'place-settings',
  'place-profile',
  'place-charter',
  'place-members',
  'place-friends',
  'place-invites',
  'place-announcements',
  'managed-places',
  'courses',
  'logistics',
  'circles',
  'admin',
]

function navigateFromPushUrl(url: string, onNavigate: MandalaNavigate): void {
  try {
    const u = new URL(url, window.location.origin)
    const pageParam = u.searchParams.get('page') as MandalaPage | null
    if (pageParam && NAV_PAGES.includes(pageParam)) {
      onNavigate(pageParam, {
        messagesChannelId: u.searchParams.get('channelId') ?? undefined,
        messagesUserId: u.searchParams.get('userId') ?? undefined,
        communitySlug: u.searchParams.get('community') ?? undefined,
      })
      return
    }
  } catch {
    /* fallback below */
  }
  onNavigate('notifications')
}

/**
 * Alerte visible quand un push arrive alors que Mandala est déjà ouvert
 * (poste ou smartphone). Complète la notif OS, souvent masquée au premier plan.
 */
export function ForegroundPushToast({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [mounted, setMounted] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearHideTimer()
    setToast(null)
  }, [clearHideTimer])

  const show = useCallback(
    (payload: PushPayload) => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      const title = (payload.title || 'Mandala').trim() || 'Mandala'
      const body = (payload.body || '').trim()
      const url = (payload.url || '/app?page=notifications').trim()
      clearHideTimer()
      seq.current += 1
      setToast({ id: seq.current, title, body, url })
      hideTimer.current = setTimeout(() => setToast(null), TOAST_MS)
    },
    [clearHideTimer]
  )

  useEffect(() => {
    setMounted(true)
    return () => clearHideTimer()
  }, [clearHideTimer])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as PushPayload | null
      if (!data || data.type !== 'MDL_PUSH_RECEIVED') return
      show(data)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [show])

  if (!mounted || !toast) return null

  return createPortal(
    <div
      className="fixed inset-x-0 z-[9999] flex justify-center px-3 pointer-events-none"
      style={{ bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))' }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-400/40 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-md px-4 py-3 flex gap-3 items-start">
        <button
          type="button"
          onClick={() => {
            const target = toast.url
            dismiss()
            navigateFromPushUrl(target, onNavigate)
          }}
          className="min-w-0 flex-1 flex gap-3 items-start text-left hover:opacity-95"
        >
          <span className="text-xl shrink-0 mt-0.5" aria-hidden>
            🔔
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-50 leading-snug">{toast.title}</span>
            {toast.body ? (
              <span className="block text-xs text-slate-300 mt-0.5 leading-relaxed line-clamp-3">
                {toast.body}
              </span>
            ) : null}
            <span className="block text-[10px] text-amber-200/70 mt-1.5">Toucher pour ouvrir</span>
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-200 text-xs shrink-0 px-1 py-0.5"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>,
    document.body
  )
}
