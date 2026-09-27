'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useCommunity } from '@/contexts/CommunityContext'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { navigateFromNotification } from '@/lib/notification-navigation'
import type { NotificationItem } from '@/contexts/NotificationContext'
import {
  isChatNotification,
  PAGE_READ_PREVIEW_LIMIT,
  splitNotificationsForDisplay,
} from '@/lib/notification-retention'

export function NotificationsPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { items, unreadCount, loading, fetchList, markRead, markAllRead, deleteRead } = useNotifications()
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

  const inbox = items.filter((n) => !isChatNotification(n.type, n.source_type) || !!n.read_at)
  const { unread, read } = splitNotificationsForDisplay(inbox, PAGE_READ_PREVIEW_LIMIT)
  const hasReads = inbox.some((n) => n.read_at)

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Centre d&apos;alertes</h1>
          <p className="text-sm text-slate-400 mt-1">
            Non lues : alertes pas encore ouvertes. Les dernières déjà consultées restent dans Notifications lues.
            Les messages restent sur le bouton Messages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-violet-300 shrink-0"
            >
              Tout marquer lu ({unreadCount})
            </button>
          )}
          {hasReads && (
            <button
              type="button"
              onClick={() => void deleteRead()}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300 shrink-0"
            >
              Effacer les lues
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}

      {!loading && unread.length === 0 && read.length === 0 && (
        <p className="text-slate-500 text-sm italic">Aucune notification pour le moment.</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-amber-300">
          Non lues{unread.length > 0 ? ` (${unread.length})` : ''}
        </h2>
        {unread.length === 0 ? (
          <p className="text-slate-500 text-sm italic">Aucune alerte non lue.</p>
        ) : (
          <NotificationList items={unread} onNavigate={onNavigate} onOpen={openNotification} onMarkRead={markRead} />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-400">Notifications lues</h2>
        <p className="text-xs text-slate-600">
          Les alertes déjà ouvertes restent ici 90 jours, dans la limite des 100 dernières.
        </p>
        {read.length === 0 ? (
          <p className="text-slate-500 text-sm italic">Aucune lecture récente.</p>
        ) : (
          <NotificationList items={read} onNavigate={onNavigate} onOpen={openNotification} onMarkRead={markRead} />
        )}
      </section>
    </div>
  )
}

function NotificationList({
  items,
  onNavigate,
  onOpen,
  onMarkRead,
}: {
  items: NotificationItem[]
  onNavigate?: MandalaNavigate
  onOpen: (n: NotificationItem) => void
  onMarkRead: (ids: string[]) => Promise<void>
}) {
  return (
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
              onClick={clickable ? () => onOpen(n) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpen(n)
                      }
                    }
                  : undefined
              }
              className={`rounded-xl border px-4 py-3 transition-colors ${
                isUnread
                  ? 'border-amber-400/50 bg-amber-500/10 border-l-2 border-l-amber-400'
                  : 'border-slate-800 bg-slate-900/40'
              } ${clickable ? 'cursor-pointer hover:border-violet-500/50 hover:bg-violet-950/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm ${isUnread ? 'font-semibold text-slate-50' : 'font-normal text-slate-400'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className={`text-xs mt-1 ${isUnread ? 'text-slate-300' : 'text-slate-500'}`}>{n.body}</p>
                  )}
                  {n.created_at && (
                    <p className="text-[10px] text-slate-600 mt-1">
                      {new Date(n.created_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                  {clickable && <p className="text-[10px] text-violet-400/80 mt-2">Ouvrir →</p>}
                </div>
                {isUnread && Number.isFinite(id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onMarkRead([n.id])
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
  )
}
