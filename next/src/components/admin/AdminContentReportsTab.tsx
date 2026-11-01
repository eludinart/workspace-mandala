'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  moderationApi,
  type ContentReportItem,
  type ContentReportStatus,
} from '@/api/moderation'
import { ApiError } from '@/lib/api-client'

const STATUS_OPTS: ContentReportStatus[] = ['new', 'reviewing', 'actioned', 'dismissed']

export function AdminContentReportsTab() {
  const [items, setItems] = useState<ContentReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await moderationApi.listReports()
      setItems(res.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(id: number, status: ContentReportStatus) {
    setBusyId(id)
    try {
      await moderationApi.updateReport(id, status)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Mise à jour impossible')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="text-sm text-slate-400 p-4">Chargement…</p>

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-100">Signalements UGC</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-violet-300 hover:underline"
        >
          Rafraîchir
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items.length === 0 && (
        <p className="text-sm text-slate-500">Aucun signalement pour le moment.</p>
      )}
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2"
          >
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-300">#{item.id}</span>
              <span>{item.target_type}:{item.target_id}</span>
              <span>{item.reason_code}</span>
              <span>par {item.reporter_name || item.reporter_id}</span>
              <span>{item.created_at}</span>
            </div>
            {item.details && (
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.details}</p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs uppercase tracking-wide text-amber-200/80">
                {item.status}
              </span>
              {STATUS_OPTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busyId === item.id || item.status === s}
                  onClick={() => void setStatus(item.id, s)}
                  className="text-[11px] rounded-lg border border-slate-700 px-2 py-1 disabled:opacity-40 hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
