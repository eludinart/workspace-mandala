'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useCommunity } from '@/contexts/CommunityContext'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { navigateFromNotification } from '@/lib/notification-navigation'
import type { NotificationItem } from '@/contexts/NotificationContext'

export function NotificationsPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { items, unreadCount, loading, fetchList, markRead, markAllRead } = useNotifications()
  const { setActiveSlug, active } = useCommunity()

  useEffect(() => {
    void fetchList({ per_page: 50 })
  }, [fetchList])

  const openNotification = (n: NotificationItem) => {
    if (!onNavigate) return
    if (!n.read_at) void markRead([n.id])
    void navigateFromNotification(n, {
      onNavigate,
      setActiveSlug,
      currentSlug: active?.slug,
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Centre d&apos;alertes</h1>
          <p className="text-sm text-slate-400 mt-1">Annonces et notifications de la communauté</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-violet-300 shrink-0"
          >
            Tout marquer lu ({unreadCount})
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}

      {!loading && items.length === 0 && (
        <p className="text-slate-500 text-sm italic">Aucune notification pour le moment.</p>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const isUnread = !n.read_at
          const id = parseInt(n.id, 10)
          const clickable = !!onNavigate
          return (
            <li key={n.delivery_id ?? n.id}>
              <div
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => openNotification(n) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openNotification(n)
                        }
                      }
                    : undefined
                }
                className={`rounded-xl border px-4 py-3 transition-colors ${
                  isUnread ? 'border-violet-500/40 bg-violet-950/20' : 'border-slate-800 bg-slate-900/40'
                } ${clickable ? 'cursor-pointer hover:border-violet-500/50 hover:bg-violet-950/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`font-medium text-sm ${isUnread ? 'text-slate-100' : 'text-slate-300'}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-slate-400 mt-1">{n.body}</p>}
                    {n.created_at && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        {new Date(n.created_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                    {clickable && (
                      <p className="text-[10px] text-violet-400/80 mt-2">Ouvrir →</p>
                    )}
                  </div>
                  {isUnread && Number.isFinite(id) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void markRead([n.id])
                      }}
                      className="text-[10px] text-violet-400 shrink-0"
                    >
                      Lu
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
