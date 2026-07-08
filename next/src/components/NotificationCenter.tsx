'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { useNotifications, type NotificationItem } from '@/contexts/NotificationContext'
import { navigateFromNotification } from '@/lib/notification-navigation'

const ICONS: Record<string, string> = {
  announcement: '📢',
  system: '⚙️',
  clairiere_message: '💬',
  chat_message: '💬',
  chat_new_message: '💬',
  event: '📅',
  targeted: '🎯',
}

const PRIORITY_RING: Record<string, string> = {
  urgent: 'ring-2 ring-rose-500',
  high: 'ring-2 ring-amber-400',
}

type AlertFilter = 'all' | 'unread' | 'announcement'

const FILTER_TABS: { id: AlertFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'unread', label: 'Non lus' },
  { id: 'announcement', label: 'Annonces' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export function NotificationCenter({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { setActiveSlug, active } = useCommunity()
  const { unreadCount, items, loading, fetchList, markRead, markAllRead, deleteRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<AlertFilter>('all')
  const anchorRef = useRef<HTMLButtonElement>(null)

  const filtered = items.filter((n) => {
    if (filter === 'unread') return !n.read_at
    if (filter === 'announcement') return (n.type ?? '').includes('announcement')
    return true
  })

  const toggle = useCallback(() => {
    if (!open) void fetchList({ per_page: 15 })
    setOpen((o) => !o)
  }, [open, fetchList])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        !target.closest('[data-notification-dropdown]')
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = (notif: NotificationItem) => {
    if (!notif.read_at) void markRead([notif.id])
    void navigateFromNotification(notif, {
      onNavigate,
      setActiveSlug,
      currentSlug: active?.slug,
    }).then((navigated) => {
      if (!navigated) onNavigate('notifications')
      setOpen(false)
    })
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        className="relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-800/80 transition-colors"
        aria-label={`Alertes${unreadCount ? ` (${unreadCount} non lues)` : ''}`}
        aria-expanded={open}
      >
        <svg
          className="w-5 h-5 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          (() => {
            const rect = anchorRef.current?.getBoundingClientRect()
            return (
              <div
                data-notification-dropdown
                className="fixed w-[min(100vw-1rem,24rem)] max-h-[min(70vh,28rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[9999] flex flex-col overflow-hidden"
                style={
                  rect
                    ? {
                        top: rect.bottom + 8,
                        right: Math.max(8, window.innerWidth - rect.right),
                        left: 'auto',
                      }
                    : { top: 56, right: 8 }
                }
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Alertes
                    {unreadCount > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-amber-400">({unreadCount})</span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="text-xs text-violet-400 hover:underline"
                    >
                      Tout lu
                    </button>
                  )}
                </div>

                <div className="flex gap-1 px-3 py-2 border-b border-slate-800 shrink-0">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                        filter === tab.id
                          ? 'bg-violet-600/40 text-slate-100 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-y-auto flex-1 min-h-0">
                  {loading && items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      Chargement…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      {filter === 'unread'
                        ? 'Aucune alerte non lue'
                        : filter === 'announcement'
                          ? 'Aucune annonce'
                          : 'Aucune alerte'}
                    </div>
                  ) : (
                    filtered.map((n) => (
                      <button
                        key={n.delivery_id ?? n.id}
                        type="button"
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-slate-800/60 ${
                          !n.read_at ? 'bg-violet-950/30' : ''
                        } ${PRIORITY_RING[n.priority ?? ''] ?? ''} border-b border-slate-800/50 last:border-b-0`}
                      >
                        <span className="text-lg shrink-0 mt-0.5">{ICONS[n.type ?? ''] ?? '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p
                              className={`text-sm leading-tight truncate ${
                                !n.read_at ? 'font-semibold text-slate-100' : 'text-slate-400'
                              }`}
                            >
                              {n.title}
                            </p>
                            {!n.read_at && (
                              <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          {n.created_at && (
                            <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {items.length > 0 && (
                  <div className="border-t border-slate-800 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
                    {items.some((n) => n.read_at) ? (
                      <button
                        type="button"
                        onClick={() => void deleteRead()}
                        className="text-xs text-slate-500 hover:text-rose-400"
                      >
                        Effacer les lues
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('notifications')
                        setOpen(false)
                      }}
                      className="text-xs text-violet-400 hover:underline"
                    >
                      Voir tout →
                    </button>
                  </div>
                )}
              </div>
            )
          })(),
          document.body
        )}
    </>
  )
}
