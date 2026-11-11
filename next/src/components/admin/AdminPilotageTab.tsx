'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminApi, type AdminPilotageDashboard, type AdminPilotageDays } from '@/api/admin'
import { ApiError } from '@/lib/api-client'
import { AdminUserSheet } from '@/components/admin/AdminUserSheet'
import { PilotageLoadChart } from '@/components/admin/PilotageLoadChart'
import { PilotageSeriesChart } from '@/components/admin/PilotageSeriesChart'
import { PILOTAGE_DAY_OPTIONS } from '@/lib/db-admin-pilotage'
import type { PilotageDrillKind, PilotageSeriesMetric } from '@/lib/db-admin-pilotage-drill'
import { formatMandalaDateTime } from '@/lib/format-datetime'

type DrillState = {
  kind: PilotageDrillKind
  day?: string
  metric?: PilotageSeriesMetric
  community_id?: number
  alert_id?: string
}

type DrillItem = {
  user_id: number | null
  label: string | null
  at: string | null
  community_id: number | null
  community_name: string | null
  meta: string | null
}

function levelClass(level: string): string {
  if (level === 'critical') return 'border-red-500/50 bg-red-600/10 text-slate-100'
  if (level === 'warning') return 'border-amber-500/50 bg-amber-600/10 text-slate-100'
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

const clickableCard =
  'rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-left transition hover:border-violet-600/50 hover:bg-slate-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500'

export function AdminPilotageTab({
  onOpenLoad,
  onOpenPush,
  onOpenPlaces,
}: {
  onOpenLoad?: () => void
  onOpenPush?: () => void
  onOpenPlaces?: (communityId?: number) => void
}) {
  const [days, setDays] = useState<AdminPilotageDays>(7)
  const [data, setData] = useState<AdminPilotageDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const [drill, setDrill] = useState<DrillState | null>(null)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [drillCursor, setDrillCursor] = useState<string | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillMsg, setDrillMsg] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [seriesMetric, setSeriesMetric] = useState<PilotageSeriesMetric>('registrations')

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

  // Tiroir au-dessus du header (z-50) : sinon le chrome reste clair et le centre grisé
  // paraît « passé dessous », contenu inaccessible.
  useEffect(() => {
    if (!drill || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrill(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drill])

  const openDrill = useCallback(
    async (state: DrillState, append = false) => {
      if (!append) {
        setDrill(state)
        setDrillItems([])
        setDrillCursor(null)
        setDrillMsg(null)
      }
      setDrillLoading(true)
      try {
        const res = await adminApi.pilotageDrill({
          kind: state.kind,
          days,
          day: state.day,
          metric: state.metric ?? seriesMetric,
          community_id: state.community_id,
          alert_id: state.alert_id,
          cursor: append ? drillCursor : null,
        })
        setDrillTitle(res.title)
        setDrillItems((prev) => (append ? [...prev, ...res.items] : res.items))
        setDrillCursor(res.next_cursor)
      } catch (e) {
        setDrillMsg(e instanceof ApiError ? e.detail : 'Impossible de charger le détail')
      } finally {
        setDrillLoading(false)
      }
    },
    [days, drillCursor, seriesMetric]
  )

  const seriesAllZero =
    !!data && data.series.every((s) => s.registrations === 0 && s.joins === 0 && s.dau === 0)
  const healthLoad = data?.health.load

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-slate-100">Pilotage</h2>
        <div
          className="flex flex-wrap gap-1 ml-2"
          role="group"
          aria-label="Période du pilotage"
        >
          {PILOTAGE_DAY_OPTIONS.map(({ days: d, label }) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-2.5 py-1 text-xs border ${
                days === d
                  ? 'border-violet-500 bg-violet-600/15 text-slate-100'
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {label}
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
        Croissance, engagement, santé des lieux et santé serveur/app. Cliquez un indicateur pour
        voir la liste. Période {data ? `${data.range.from} → ${data.range.to}` : '…'}{' '}
        (Europe/Paris).
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
                {data.alerts.map((a) => {
                  const isProduct = a.id.startsWith('pilotage-')
                  const isPush = a.source === 'push' || a.href?.includes('adminTab=push')
                  const isLoad =
                    a.source === 'pool' ||
                    a.source === 'http' ||
                    a.href?.includes('adminTab=load')
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-left ${levelClass(a.level)} hover:opacity-95`}
                        onClick={() => {
                          if (isProduct) {
                            void openDrill({ kind: 'alert', alert_id: a.id })
                          } else if (isPush) {
                            onOpenPush?.()
                          } else if (isLoad) {
                            onOpenLoad?.()
                          } else if (a.href?.includes('push')) {
                            onOpenPush?.()
                          } else {
                            onOpenLoad?.()
                          }
                        }}
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[10px] uppercase opacity-70">{a.level}</span>
                          <span className="font-medium">{a.title}</span>
                          <span className="text-[10px] uppercase opacity-50">{a.source}</span>
                        </div>
                        <p className="mt-1 text-xs opacity-90">{a.detail}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">KPI</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { label: 'Comptes', value: data.kpis.total_users, kind: 'total_users' as const },
                  {
                    label: `Inscriptions (${days} j)`,
                    value: data.kpis.registrations,
                    kind: 'registrations' as const,
                  },
                  {
                    label: `Rejoins (${days} j)`,
                    value: data.kpis.joins,
                    kind: 'joins' as const,
                  },
                  {
                    label: 'Sans lieu',
                    value: data.kpis.continue_without_place,
                    kind: 'continue_without_place' as const,
                  },
                  {
                    label: 'Vus (24 h)',
                    value: data.kpis.active_24h,
                    kind: 'active_24h' as const,
                    hint: 'Dernière présence enregistrée sur 24 h',
                  },
                  {
                    label: 'Actifs du jour',
                    value: data.kpis.dau,
                    kind: 'dau' as const,
                    hint: 'Personnes connectées aujourd’hui (jour Paris)',
                  },
                  {
                    label: 'Actifs 7 j',
                    value: data.kpis.wau,
                    kind: 'wau' as const,
                    hint: 'Personnes connectées au moins une fois sur 7 jours',
                  },
                  {
                    label: 'Actifs 30 j',
                    value: data.kpis.mau,
                    kind: 'mau' as const,
                    hint: 'Personnes connectées au moins une fois sur 30 jours',
                  },
                ] as const
              ).map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  title={'hint' in k ? k.hint : undefined}
                  className={`${clickableCard} min-h-[4.25rem]`}
                  onClick={() => void openDrill({ kind: k.kind })}
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 leading-tight">
                    {k.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-100 tabular-nums leading-none">
                    {k.value}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Vie du réseau
              </h3>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Échelle de temps du chart"
              >
                {PILOTAGE_DAY_OPTIONS.map(({ days: d, label }) => (
                  <button
                    key={`chart-${d}`}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`rounded-lg px-2.5 py-1 text-xs border ${
                      days === d
                        ? 'border-violet-500 bg-violet-600/15 text-slate-100'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
            <p className="text-xs text-slate-400">
              Inscriptions, rejoins et actifs (jour Paris). Changez l’échelle pour zoomer dans le
              temps — cliquez un point pour la liste du jour.
            </p>
            {seriesAllZero && (
              <p className="text-sm text-slate-500 rounded-lg border border-slate-800 px-3 py-2">
                Aucune activité mesurée sur ces jours — les compteurs monteront avec les
                inscriptions, joins et sessions.
              </p>
            )}
            <PilotageSeriesChart
              series={data.series}
              onSelectDay={(day, metric) =>
                void openDrill({ kind: 'series_day', day, metric })
              }
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Funnel onboarding
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              {(
                [
                  {
                    label: 'Inscrits',
                    value: String(data.funnel.registered),
                    kind: 'funnel_registered' as const,
                  },
                  {
                    label: '→ Lieu',
                    value: `${data.funnel.chose_place} (${pct(data.funnel.chose_place, data.funnel.registered)})`,
                    kind: 'funnel_place' as const,
                  },
                  {
                    label: '→ Sans lieu',
                    value: `${data.funnel.continue_without_place} (${pct(data.funnel.continue_without_place, data.funnel.registered)})`,
                    kind: 'funnel_no_place' as const,
                  },
                  {
                    label: 'Actif J+1',
                    value: `${data.funnel.active_d1} (${pct(data.funnel.active_d1, data.funnel.registered)})`,
                    kind: 'funnel_d1' as const,
                  },
                  {
                    label: 'Actif ≤J+7',
                    value: `${data.funnel.active_d7} (${pct(data.funnel.active_d7, data.funnel.registered)})`,
                    kind: 'funnel_d7' as const,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={clickableCard}
                  onClick={() => void openDrill({ kind: f.kind })}
                >
                  <p className="text-[10px] uppercase text-slate-500">{f.label}</p>
                  <p className="font-medium text-slate-100 tabular-nums">{f.value}</p>
                </button>
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
                    <tr
                      key={p.id}
                      className="border-t border-slate-800/80 text-slate-200 hover:bg-slate-900/50 cursor-pointer"
                      onClick={() => void openDrill({ kind: 'place', community_id: p.id })}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-violet-200">{p.name}</span>
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
                  <li key={`${a.at}-${a.kind}-${a.user_id}-${i}`}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-800/80 px-3 py-1.5 text-xs text-slate-300 text-left hover:border-violet-600/40"
                      onClick={() => {
                        if (a.user_id != null) setSelectedUserId(a.user_id)
                        else if (a.community_id != null)
                          void openDrill({ kind: 'place', community_id: a.community_id })
                      }}
                    >
                      <span className="text-slate-500 tabular-nums">{a.at}</span>
                      <span className="mx-2 text-violet-300">{kindLabel(a.kind)}</span>
                      <span>{a.user_label ?? (a.user_id != null ? `#${a.user_id}` : '—')}</span>
                      {a.community_name && (
                        <span className="ml-2 text-slate-500">· {a.community_name}</span>
                      )}
                    </button>
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
              Même source que Charge & alertes. Cliquez pour ouvrir l’onglet détaillé.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'RPS', value: String(healthLoad?.rps ?? '—'), go: 'load' as const },
                {
                  label: 'Latence moy.',
                  value: healthLoad ? `${healthLoad.avgMs} ms` : '—',
                  go: 'load' as const,
                },
                {
                  label: 'p95',
                  value: healthLoad ? `${healthLoad.p95Ms} ms` : '—',
                  go: 'load' as const,
                },
                {
                  label: 'Erreurs',
                  value: healthLoad
                    ? `${healthLoad.errors} (${Math.round(healthLoad.errorRate * 100)}%)`
                    : '—',
                  go: 'load' as const,
                },
              ].map((k) => (
                <button
                  key={k.label}
                  type="button"
                  className={clickableCard}
                  onClick={() => onOpenLoad?.()}
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</p>
                  <p className="text-lg font-semibold text-slate-100 tabular-nums">{k.value}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => onOpenLoad?.()}
              >
                Ouvrir Charge & alertes →
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => onOpenPush?.()}
              >
                Ouvrir Push →
              </button>
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
                    Push {data.health.push.accepted} accepted · {data.health.push.delivered}{' '}
                    delivered
                  </p>
                </>
              )}
            </div>
            {healthLoad && healthLoad.series.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Charge (RPS)</p>
                <PilotageLoadChart series={healthLoad.series} onOpenLoad={onOpenLoad} />
              </div>
            )}
          </section>
        </>
      )}

      {drill &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex justify-end bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-label={drillTitle || 'Détail pilotage'}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Fermer le détail"
              onClick={() => setDrill(null)}
            />
            <div className="relative z-10 flex h-full w-full max-w-md min-h-0 flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
              <div className="shrink-0 flex items-start gap-2 border-b border-slate-800 px-4 py-3 bg-slate-950">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Détail</p>
                  <h3 className="text-base font-medium text-slate-100 truncate">{drillTitle}</h3>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                  onClick={() => setDrill(null)}
                >
                  Fermer
                </button>
              </div>
              {drill.kind === 'series_day' && (
                <div className="shrink-0 flex gap-1 border-b border-slate-800 px-4 py-2 bg-slate-950">
                  {(
                    [
                      ['registrations', 'Inscriptions'],
                      ['joins', 'Rejoins'],
                      ['dau', 'Actifs'],
                    ] as const
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      className={`rounded-lg px-2 py-1 text-[11px] border ${
                        (drill.metric ?? seriesMetric) === m
                          ? 'border-violet-500 bg-violet-600/15 text-slate-100'
                          : 'border-slate-700 text-slate-400'
                      }`}
                      onClick={() => {
                        setSeriesMetric(m)
                        void openDrill({ ...drill, metric: m })
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-2">
                {drillMsg && <p className="text-sm text-amber-700">{drillMsg}</p>}
                {drillLoading && drillItems.length === 0 && (
                  <p className="text-sm text-slate-400">Chargement…</p>
                )}
                {!drillLoading && drillItems.length === 0 && !drillMsg && (
                  <p className="text-sm text-slate-500">Aucun élément.</p>
                )}
                {drillItems.map((item, i) => {
                  const title =
                    (item.label && item.label.trim()) ||
                    (item.user_id != null ? `Personne #${item.user_id}` : null) ||
                    item.community_name ||
                    '—'
                  return (
                  <button
                    key={`${item.user_id}-${item.community_id}-${item.at}-${i}`}
                    type="button"
                    className="shrink-0 w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-left text-sm text-slate-200 hover:border-violet-600/50"
                    onClick={() => {
                      if (item.user_id != null) {
                        setSelectedUserId(item.user_id)
                      } else if (item.community_id != null) {
                        onOpenPlaces?.(item.community_id)
                        setDrill(null)
                      }
                    }}
                  >
                    <div className="font-medium break-words">{title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500 break-words">
                      {item.at && (
                        <span className="tabular-nums">{formatMandalaDateTime(item.at)}</span>
                      )}
                      {item.community_name && item.user_id != null && (
                        <span className="ml-2">· {item.community_name}</span>
                      )}
                      {item.meta && <span className="ml-2">· {item.meta}</span>}
                    </div>
                    {item.user_id != null && (
                      <span className="mt-1 inline-block text-[10px] text-violet-600">
                        Fiche personne →
                      </span>
                    )}
                    {item.user_id == null && item.community_id != null && (
                      <span className="mt-1 inline-block text-[10px] text-violet-600">
                        Ouvrir le lieu →
                      </span>
                    )}
                  </button>
                  )
                })}
                {drillCursor && (
                  <button
                    type="button"
                    disabled={drillLoading}
                    className="w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-50"
                    onClick={() => drill && void openDrill(drill, true)}
                  >
                    {drillLoading ? 'Chargement…' : 'Charger plus'}
                  </button>
                )}
                {drill.kind === 'place' && drill.community_id != null && (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-violet-500/40 py-2 text-xs text-slate-100 hover:bg-violet-600/10"
                    onClick={() => {
                      onOpenPlaces?.(drill.community_id)
                      setDrill(null)
                    }}
                  >
                    Ouvrir dans Lieux & communautés →
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {selectedUserId != null && (
        <AdminUserSheet
          userId={selectedUserId}
          canEditAppRole
          canEditCommunityRoles
          onClose={() => setSelectedUserId(null)}
          onSaved={() => {}}
          onRemoved={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}
