'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/lib/api-client'

export function AdminUserPushPanel({ userId }: { userId: number }) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.push.user>> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminApi.push.user(userId))
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : 'Impossible de charger le push')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const testPush = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await adminApi.push.testUser(userId)
      if (res.ok) {
        setMsg(`Test envoyé — sent=${res.sent ?? 0}, gone=${res.gone ?? 0}, errors=${res.errors ?? 0}`)
        await load()
      } else setMsg(res.error ?? 'Échec test')
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : 'Échec test push')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 border-t border-slate-800 pt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-widest text-sky-300">Push</h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => void testPush()}
          className="ml-auto text-xs px-2 py-1 rounded border border-sky-800/60 text-sky-100 hover:bg-sky-950/40 disabled:opacity-50"
        >
          Test push
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400"
        >
          Rafraîchir
        </button>
      </div>

      {msg && <p className="text-xs text-slate-300">{msg}</p>}
      {loading && <p className="text-xs text-slate-500">Chargement…</p>}

      {data && !loading && (
        <>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Appareils</p>
            {data.devices.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun abonnement enregistré.</p>
            ) : (
              <ul className="space-y-1">
                {data.devices.map((d) => (
                  <li key={d.id} className="text-xs text-slate-300 rounded border border-slate-800 px-2 py-1.5">
                    <span className="text-sky-200/90">{d.platform ?? 'unknown'}</span>
                    {d.standalone != null && (
                      <span className="text-slate-500"> · {d.standalone ? 'PWA' : 'navigateur'}</span>
                    )}
                    <div className="text-slate-500 truncate">{d.user_agent ?? '—'}</div>
                    <div className="text-slate-600">vu {d.last_seen_at ?? d.updated_at ?? '—'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Derniers envois</p>
            {data.sends.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun envoi tracé.</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-auto">
                {data.sends.map((s) => (
                  <li key={s.id} className="text-xs text-slate-300 rounded border border-slate-800 px-2 py-1.5">
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-slate-500">#{s.id}</span>
                      <span className="text-amber-200/80">{s.status}</span>
                      {s.delivered_at && <span className="text-emerald-300/80">delivered</span>}
                      {s.opened_at && <span className="text-sky-300/80">opened</span>}
                    </div>
                    <div className="truncate">{s.title}</div>
                    <div className="text-slate-600">{s.created_at}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
