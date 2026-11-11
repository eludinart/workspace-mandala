'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminPilotageDashboard } from '@/api/admin'
import { ApiError } from '@/lib/api-client'

function levelClass(level: string): string {
  if (level === 'critical') return 'border-red-700/70 bg-red-950/40 text-red-100'
  if (level === 'warning') return 'border-amber-700/60 bg-amber-950/30 text-amber-100'
  return 'border-slate-700 bg-slate-900/60 text-slate-200'
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'user.registered':
      return 'Inscription'
    case 'place.joined':
      return 'Rejoint un lieu'
    case 'place.left':
      return 'Quitte un lieu'
    case 'onboarding.continue_without_place':
      return 'Sans lieu'
    case 'charter.accepted':
      return 'Charte'
    case 'session.daily':
      return 'Session'
    default:
      return kind
  }
}

function pct(n: number, d: number): string {
  if (!d) return '—'
  return `${Math.round((n / d) * 100)}%`
}

function escCsv(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export function AdminPilotageTab() {
  const [days, setDays] = useState<7 | 30 | 90>(7)
  const [data, setData] = useState<AdminPilotageDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      const soft = opts?.soft ?? false
      if (!soft) setLoading(true)
      setMsg(null)
      try {
        setData(await adminApi.pilotage(days))
      } catch (e) {
        setMsg(e instanceof ApiError ? e.detail : 'Impossible de charger le pilotage')
        if (!soft) setData(null)
      } finally {
        if (!soft) setLoading(false)
      }
    },
    [days]
  )

  useEffect(() => {
    void load()
    const t = setInterval(() => void load({ soft: true }), 60_000)
    return () => clearInterval(t)
  }, [load])

  const maxBar = Math.max(
    1,
    ...(data?.series.flatMap((s) => [s.registrations, s.joins, s.dau]) ?? [1])
  )
  const healthLoad = data?.health.load
  const maxHealthBar = Math.max(1, ...(healthLoad?.series.map((s) => s.rps) ?? [1]))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-slate-100">Pilotage</h2>
        <div className="flex gap-1 ml-2">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-2.5 py-1 text-xs border ${
                days === d
                  ? 'border-violet-500 bg-violet-950/50 text-violet-100'
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {d} j
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Croissance, engagement, santé des lieux et santé serveur/app. Période{' '}
        {data ? `${data.range.from} → ${data.range.to}` : '…'} (Europe/Paris).
      </p>

      {msg && <p className="text-sm text-amber-200/90">{msg}</p>}
      {loading && !data && <p className="text-sm text-slate-400">Chargement…</p>}

      {data && (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Alertes
            </h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">KPI</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Comptes', value: String(data.kpis.total_users) },
                { label: `Inscriptions (${days} j)`, value: String(data.kpis.registrations) },
                { label: `Joins (${days} j)`, value: String(data.kpis.joins) },
                { label: 'Sans lieu', value: String(data.kpis.continue_without_place) },
                { label: 'Actifs 24 h', value: String(data.kpis.active_24h) },
                { label: 'DAU', value: String(data.kpis.dau) },
                { label: 'WAU', value: String(data.kpis.wau) },
                { label: 'MAU', value: String(data.kpis.mau) },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</p>
                  <p className="text-lg font-semibold text-slate-100 tabular-nums">{k.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Séries journalières
              </h3>
              <button
                type="button"
                className="ml-auto text-xs text-slate-400 underline hover:text-slate-200"
                onClick={() => {
                  const lines = [
                    'day,registrations,joins,dau',
                    ...data.series.map(
                      (s) => `${s.day},${s.registrations},${s.joins},${s.dau}`
                    ),
                  ]
                  downloadTextFile(`mandala-pilotage-series-${days}d.csv`, lines.join('\n'))
                }}
              >
                Export CSV
              </button>
            </div>
            <div className="space-y-1.5">
              {data.series.map((s) => (
                <div key={s.day} className="grid grid-cols-[4.5rem_1fr] gap-2 items-center">
                  <span className="text-[10px] text-slate-500 tabular-nums">{s.day.slice(5)}</span>
                  <div className="flex h-4 gap-0.5">
                    <div
                      title={`inscriptions ${s.registrations}`}
                      className="h-full rounded-sm bg-emerald-600/80"
                      style={{ width: `${(s.registrations / maxBar) * 100}%`, minWidth: s.registrations ? 2 : 0 }}
                    />
                    <div
                      title={`joins ${s.joins}`}
                      className="h-full rounded-sm bg-sky-600/80"
                      style={{ width: `${(s.joins / maxBar) * 100}%`, minWidth: s.joins ? 2 : 0 }}
                    />
                    <div
                      title={`dau ${s.dau}`}
                      className="h-full rounded-sm bg-violet-600/70"
                      style={{ width: `${(s.dau / maxBar) * 100}%`, minWidth: s.dau ? 2 : 0 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              Vert = inscriptions · Bleu = joins · Violet = DAU
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Funnel onboarding
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              {[
                { label: 'Inscrits', value: data.funnel.registered },
                {
                  label: '→ Lieu',
                  value: `${data.funnel.chose_place} (${pct(data.funnel.chose_place, data.funnel.registered)})`,
                },
                {
                  label: '→ Sans lieu',
                  value: `${data.funnel.continue_without_place} (${pct(data.funnel.continue_without_place, data.funnel.registered)})`,
                },
                {
                  label: 'Actif J+1',
                  value: `${data.funnel.active_d1} (${pct(data.funnel.active_d1, data.funnel.registered)})`,
                },
                {
                  label: 'Actif ≤J+7',
                  value: `${data.funnel.active_d7} (${pct(data.funnel.active_d7, data.funnel.registered)})`,
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <p className="text-[10px] uppercase text-slate-500">{f.label}</p>
                  <p className="font-medium text-slate-100 tabular-nums">{f.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Santé des lieux
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Lieu</th>
                    <th className="px-3 py-2 font-medium">Membres</th>
                    <th className="px-3 py-2 font-medium">Joins 30 j</th>
                    <th className="px-3 py-2 font-medium">Départs 30 j</th>
                    <th className="px-3 py-2 font-medium">Actifs 7 j</th>
                  </tr>
                </thead>
                <tbody>
                  {data.places.map((p) => (
                    <tr key={p.id} className="border-t border-slate-800/80 text-slate-200">
                      <td className="px-3 py-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-1 text-slate-500">{p.slug}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{p.members}</td>
                      <td className="px-3 py-2 tabular-nums">{p.joins_30d}</td>
                      <td className="px-3 py-2 tabular-nums">{p.left_30d}</td>
                      <td className="px-3 py-2 tabular-nums">{p.active_members_7d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Fil d’activité
              </h3>
              <button
                type="button"
                className="ml-auto text-xs text-slate-400 underline hover:text-slate-200"
                onClick={() => {
                  const lines = [
                    'at,kind,user_id,user_label,community_id,community_name',
                    ...data.activity.map((a) =>
                      [
                        escCsv(a.at),
                        escCsv(a.kind),
                        escCsv(a.user_id),
                        escCsv(a.user_label),
                        escCsv(a.community_id),
                        escCsv(a.community_name),
                      ].join(',')
                    ),
                  ]
                  downloadTextFile(`mandala-pilotage-activity-${days}d.csv`, lines.join('\n'))
                }}
              >
                Export CSV
              </button>
            </div>
            {data.activity.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun événement sur la période.</p>
            ) : (
              <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                {data.activity.map((a, i) => (
                  <li
                    key={`${a.at}-${a.kind}-${a.user_id}-${i}`}
                    className="rounded-lg border border-slate-800/80 px-3 py-1.5 text-xs text-slate-300"
                  >
                    <span className="text-slate-500 tabular-nums">{a.at}</span>
                    <span className="mx-2 text-violet-300">{kindLabel(a.kind)}</span>
                    <span>{a.user_label ?? (a.user_id != null ? `#${a.user_id}` : '—')}</span>
                    {a.community_name && (
                      <span className="ml-2 text-slate-500">· {a.community_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Santé serveur & application
            </h3>
            <p className="text-xs text-slate-500">
              Même source que Charge & alertes (mémoire process + overview push). Fenêtre ~
              {healthLoad?.windowSec ?? 60}s.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'RPS', value: String(healthLoad?.rps ?? '—') },
                { label: 'Latence moy.', value: healthLoad ? `${healthLoad.avgMs} ms` : '—' },
                { label: 'p95', value: healthLoad ? `${healthLoad.p95Ms} ms` : '—' },
                {
                  label: 'Erreurs',
                  value: healthLoad
                    ? `${healthLoad.errors} (${Math.round(healthLoad.errorRate * 100)}%)`
                    : '—',
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</p>
                  <p className="text-lg font-semibold text-slate-100 tabular-nums">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400">
              <p>
                Pool limit {data.health.pool.connectionLimit} · maxIdle {data.health.pool.maxIdle} ·
                queue {data.health.pool.queueLimit}
              </p>
              <p>Enqueue récent {healthLoad?.poolEnqueueRecent ?? 0}</p>
              {data.health.push && (
                <>
                  <p>
                    Push delivery{' '}
                    {data.health.push.delivery_rate != null
                      ? `${Math.round(data.health.push.delivery_rate * 100)}%`
                      : '—'}
                  </p>
                  <p>
                    Push {data.health.push.accepted} accepted · {data.health.push.delivered} delivered
                  </p>
                </>
              )}
            </div>
            {healthLoad && healthLoad.series.length > 0 && (
              <div className="flex h-10 items-end gap-px">
                {healthLoad.series.map((s) => (
                  <div
                    key={s.at}
                    title={`${s.rps} rps · ${s.avgMs} ms · ${s.errors} err`}
                    className="flex-1 rounded-t-sm bg-slate-600/80"
                    style={{ height: `${Math.max(8, (s.rps / maxHealthBar) * 100)}%` }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
