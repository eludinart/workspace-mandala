'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/lib/api-client'

function pct(rate: number | null): string {
  if (rate == null) return '—'
  return `${Math.round(rate * 100)}%`
}

export function AdminPushTab() {
  const [range, setRange] = useState<'24h' | '7d'>('24h')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.push.overview>> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      setData(await adminApi.push.overview(range))
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : 'Impossible de charger le suivi push')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const runCheck = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await adminApi.push.checkAlerts()
      const rateLabel = pct(Number(res.rate) || null)
      if (res.alerted && res.skipped_cooldown) {
        setMsg(
          `Seuil bas (${rateLabel}) — alerte déjà envoyée (cooldown ${Number(res.cooldown_hours) || 48}h).`
        )
      } else if (res.alerted) {
        setMsg(
          `Alerte envoyée (taux ${rateLabel}, seuil ${pct(Number(res.threshold) || null)}).`
        )
      } else {
        setMsg(`Check OK — taux ${rateLabel} (${res.delivered}/${res.accepted}).`)
      }
      await load()
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : 'Échec du check alertes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-slate-100">Suivi push</h2>
        <div className="ml-auto flex gap-2">
          {(['24h', '7d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-xs border ${
                range === r
                  ? 'border-amber-500/50 bg-amber-600/15 text-slate-100'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void runCheck()}
            className="rounded-lg px-3 py-1.5 text-xs border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Check alertes
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg px-3 py-1.5 text-xs border border-slate-700 text-slate-400"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <code className="text-slate-400">delivered</code> = le service worker a affiché la notif.
        Sans ack après réveil téléphone = non reçu (ou appareil jamais réveillé).
      </p>

      {msg && <p className="text-sm text-amber-200/90">{msg}</p>}
      {loading && <p className="text-sm text-slate-400">Chargement…</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Accepted', value: data.accepted },
              { label: 'Delivered', value: data.delivered },
              { label: 'Opened', value: data.opened },
              { label: 'Taux livré', value: pct(data.delivery_rate) },
              { label: 'Taux ouvert', value: pct(data.open_rate) },
              { label: 'Gone', value: data.gone },
              { label: 'Error', value: data.error },
              { label: 'Sans ack >1h', value: data.pending_accepted },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
                <div className="mt-1 text-xl text-slate-100 tabular-nums">{c.value}</div>
              </div>
            ))}
          </div>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-slate-400">Échecs récents</h3>
            {data.recent_failures.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun sur cette période.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.recent_failures.map((f) => (
                  <li
                    key={f.id}
                    className="rounded border border-slate-800 px-3 py-2 text-slate-300 flex flex-wrap gap-x-3 gap-y-1"
                  >
                    <span className="text-slate-500">#{f.id}</span>
                    <span>user {f.user_id}</span>
                    <span className="text-amber-200/80">{f.status}</span>
                    <span className="truncate max-w-[14rem]">{f.title}</span>
                    {f.error_detail && (
                      <span className="text-xs text-red-300/80 truncate max-w-full">{f.error_detail}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-slate-400">
              Users avec accepted, jamais delivered
            </h3>
            {data.users_never_delivered.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun sur cette période.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.users_never_delivered.map((u) => (
                  <li
                    key={u.user_id}
                    className="rounded border border-slate-800 px-3 py-2 text-slate-300 flex gap-3"
                  >
                    <span>user {u.user_id}</span>
                    <span className="text-slate-500">{u.devices} app.</span>
                    <span className="text-slate-500">{u.last_accepted_at ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
