'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminLoadDashboard } from '@/api/admin'
import { ApiError } from '@/lib/api-client'

function levelClass(level: string): string {
  if (level === 'critical') return 'border-red-700/70 bg-red-950/40 text-red-100'
  if (level === 'warning') return 'border-amber-700/60 bg-amber-950/30 text-amber-100'
  return 'border-slate-700 bg-slate-900/60 text-slate-200'
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function AdminLoadTab() {
  const [data, setData] = useState<AdminLoadDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false
    if (!soft) setLoading(true)
    setMsg(null)
    try {
      setData(await adminApi.load())
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : 'Impossible de charger la charge serveur')
      if (!soft) setData(null)
    } finally {
      if (!soft) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // 30 s : l’overview push est aussi caché ~45 s côté serveur.
    const t = setInterval(() => void load({ soft: true }), 30_000)
    return () => clearInterval(t)
  }, [load])

  const loadSnap = data?.load
  const maxBar = Math.max(1, ...(loadSnap?.series.map((s) => s.rps) ?? [1]))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-slate-100">Charge & alertes</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Métriques en mémoire process (reset au redeploy). Fenêtre ~{loadSnap?.windowSec ?? 60}s.
        Détail push : onglet <span className="text-slate-400">Push (accusés)</span> dans Ressources
        techniques.
      </p>

      {msg && <p className="text-sm text-amber-200/90">{msg}</p>}
      {loading && !data && <p className="text-sm text-slate-400">Chargement…</p>}

      {data && (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Alertes</h3>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-emerald-400/90">Aucune alerte active.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${levelClass(a.level)}`}
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[10px] uppercase opacity-70">{a.level}</span>
                      <span className="font-medium">{a.title}</span>
                      <span className="text-[10px] uppercase opacity-50">{a.source}</span>
                    </div>
                    <p className="mt-1 text-xs opacity-90">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Charge serveur
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'RPS', value: String(data.load.rps) },
                { label: 'Latence moy.', value: `${data.load.avgMs} ms` },
                { label: 'p95', value: `${data.load.p95Ms} ms` },
                { label: 'Erreurs 5xx', value: `${data.load.errors} (${pct(data.load.errorRate)})` },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="text-[10px] uppercase text-slate-500">{c.label}</div>
                  <div className="text-lg text-slate-100 tabular-nums">{c.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              Pool MariaDB : limit {data.pool.connectionLimit} · maxIdle {data.pool.maxIdle} · queue{' '}
              {data.pool.queueLimit} · idle {data.pool.idleTimeoutMs} ms · enqueue récents{' '}
              {data.load.poolEnqueueRecent} (total {data.load.poolEnqueueTotal})
            </div>

            {data.load.series.length > 0 && (
              <div>
                <div className="text-[10px] uppercase text-slate-500 mb-1">
                  RPS (buckets ~30 s, ~15 min)
                </div>
                <div className="flex items-end gap-0.5 h-16">
                  {data.load.series.map((s) => (
                    <div
                      key={s.at}
                      title={`${new Date(s.at).toLocaleTimeString('fr-FR')} · ${s.rps} rps · ${s.avgMs} ms`}
                      className="flex-1 min-w-0 rounded-sm bg-sky-700/70"
                      style={{ height: `${Math.max(4, (s.rps / maxBar) * 100)}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Top endpoints lents</h3>
              {data.load.topSlow.length === 0 ? (
                <p className="text-xs text-slate-500">Pas encore assez de trafic.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.load.topSlow.map((p) => (
                    <li
                      key={p.path}
                      className="flex justify-between gap-2 border-b border-slate-800/80 py-1"
                    >
                      <code className="text-slate-300 truncate">{p.path}</code>
                      <span className="shrink-0 text-slate-400 tabular-nums">
                        p95 {p.p95Ms}ms · n={p.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Top erreurs</h3>
              {data.load.topErrors.length === 0 ? (
                <p className="text-xs text-slate-500">Aucune erreur 5xx récente.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.load.topErrors.map((p) => (
                    <li
                      key={p.path}
                      className="flex justify-between gap-2 border-b border-slate-800/80 py-1"
                    >
                      <code className="text-red-300/90 truncate">{p.path}</code>
                      <span className="shrink-0 text-slate-400 tabular-nums">
                        {p.errors} err · n={p.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {data.push && (
            <section className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-xs text-slate-400">
              <div className="font-medium text-slate-300 mb-1">Push 24h (aperçu)</div>
              accepted {data.push.accepted} · delivered {data.push.delivered} · opened{' '}
              {data.push.opened} · gone {data.push.gone} · error {data.push.error} · sans ack{' '}
              {data.push.pending_accepted}
              {data.push.delivery_rate != null && (
                <> · livraison {pct(data.push.delivery_rate)}</>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
