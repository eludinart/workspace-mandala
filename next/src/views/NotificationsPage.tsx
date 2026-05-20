'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import type { MandalaNavigate } from '@/components/MandalaApp'

export function NotificationsPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { items, unreadCount, loading, fetchList, markRead, markAllRead } = useNotifications()

  useEffect(() => {
    void fetchList({ per_page: 50 })
  }, [fetchList])

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
          return (
            <li
              key={n.delivery_id ?? n.id}
              className={`rounded-xl border px-4 py-3 ${
                isUnread ? 'border-violet-500/40 bg-violet-950/20' : 'border-slate-800 bg-slate-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{n.title}</p>
                  {n.body && <p className="text-xs text-slate-400 mt-1">{n.body}</p>}
                  {n.created_at && (
                    <p className="text-[10px] text-slate-600 mt-1">
                      {new Date(n.created_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
                {isUnread && Number.isFinite(id) && (
                  <button
                    type="button"
                    onClick={() => void markRead([n.id])}
                    className="text-[10px] text-violet-400 shrink-0"
                  >
                    Lu
                  </button>
                )}
              </div>
              {n.action_url && onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read_at) void markRead([n.id])
                    const url = n.action_url!.toLowerCase()
                    if (url.includes('message')) onNavigate('messages')
                    else if (url.includes('event')) onNavigate('events')
                    else onNavigate('notifications')
                  }}
                  className="inline-block mt-2 text-xs text-violet-400 hover:underline"
                >
                  {n.action_label ?? 'Voir'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
