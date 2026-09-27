'use client'

import { useCallback, useEffect, useState } from 'react'
import { supportApi, type SupportReportItem, type SupportStatus } from '@/api/support'
import { ApiError } from '@/lib/api-client'
import { PAGE_LABELS } from '@/lib/nav'
import type { MandalaPage } from '@/components/MandalaApp'

const STATUS_LABEL: Record<SupportStatus, string> = {
  new: 'Nouveau',
  read: 'Lu',
  done: 'Traité',
}

function pageLabel(page: string): string {
  return PAGE_LABELS[page as MandalaPage] ?? page
}

export function AdminSupportTab() {
  const [items, setItems] = useState<SupportReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await supportApi.list()
      setItems(data.items ?? [])
    } catch (err: unknown) {
      setItems([])
      setError(err instanceof ApiError ? err.detail : 'Impossible de charger les retours')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (id: number, status: SupportStatus) => {
    setBusyId(id)
    setError(null)
    try {
      await supportApi.setStatus(id, status)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Mise à jour impossible')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Retours</h2>
      <p className="text-sm text-slate-400">
        Questions et bugs envoyés depuis le bouton ? de l’application.
      </p>
      <button
        type="button"
        onClick={() => void load()}
        className="text-sm px-3 py-1 border border-slate-700 rounded-lg"
      >
        Rafraîchir
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
      {!loading && items.length === 0 && (
        <p className="text-slate-500 text-sm italic">Aucun retour pour le moment.</p>
      )}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-full ${
                  item.kind === 'bug' ? 'bg-red-950 text-red-300' : 'bg-violet-950 text-violet-200'
                }`}
              >
                {item.kind === 'bug' ? 'Bug' : 'Question'}
              </span>
              <span className="text-slate-400">{STATUS_LABEL[item.status]}</span>
              <span className="text-slate-500">#{item.id}</span>
              <span className="text-slate-500">
                {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : ''}
              </span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.message}</p>
            <p className="text-xs text-slate-500">
              {item.author_name}
              {item.author_email ? ` · ${item.author_email}` : ''} · {pageLabel(item.page)}
              {item.community_slug ? ` · ${item.community_slug}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.status !== 'read' && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void setStatus(item.id, 'read')}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
                >
                  Marquer lu
                </button>
              )}
              {item.status !== 'done' && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void setStatus(item.id, 'done')}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
                >
                  Traité
                </button>
              )}
              {item.status !== 'new' && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void setStatus(item.id, 'new')}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
                >
                  Remettre en nouveau
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
