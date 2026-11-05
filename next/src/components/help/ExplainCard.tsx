'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import {
  EXPLAIN_COPY,
  type ExplainScreen,
} from '@/lib/db-explain-cards'
import { useFeatureDoors } from '@/hooks/useFeatureDoors'

export function ExplainCard({ screen }: { screen: ExplainScreen }) {
  const { can, loading: doorsLoading } = useFeatureDoors()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const copy = EXPLAIN_COPY[screen]

  useEffect(() => {
    if (doorsLoading || !can('aide_contextuelle')) {
      setVisible(false)
      return
    }
    let cancelled = false
    void api
      .get('/api/explain-cards')
      .then((res: { door_open?: boolean; dismissed?: string[] }) => {
        if (cancelled) return
        const dismissed = new Set(res.dismissed ?? [])
        setVisible(Boolean(res.door_open) && !dismissed.has(screen))
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })
    return () => {
      cancelled = true
    }
  }, [can, doorsLoading, screen])

  const dismiss = useCallback(async () => {
    setBusy(true)
    try {
      await api.post('/api/explain-cards', { screen })
      setVisible(false)
    } catch {
      setVisible(false)
    } finally {
      setBusy(false)
    }
  }, [screen])

  if (!visible) return null

  return (
    <aside className="rounded-2xl border border-sky-800/40 bg-sky-950/25 px-4 py-3 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-sky-300/80">À savoir</p>
      <h3 className="text-sm font-semibold text-slate-100">{copy.title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed">{copy.body}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void dismiss()}
        className="text-xs px-3 py-1.5 rounded-full bg-sky-700/80 text-white hover:bg-sky-600 disabled:opacity-50"
      >
        Compris
      </button>
    </aside>
  )
}
