'use client'

import { useCallback, useEffect, useState } from 'react'
import { billingApi } from '@/api/billing'
import {
  ADMIN_BILLING_OPS_LABELS,
  type AdminBillingOpsStatus,
} from '@/lib/admin-billing-ops'

type FamilyFilter = 'all' | 'place' | 'pro'
type SortKey =
  | 'urgency'
  | 'period_end'
  | 'family'
  | 'target'
  | 'provider'
  | 'updated_at'

type SubRow = Awaited<
  ReturnType<typeof billingApi.listAdminSubscriptions>
>['items'][number]

const PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  play: 'Google Play',
  comp: 'Cadeau',
}

const OPS_CLASS: Record<AdminBillingOpsStatus, string> = {
  active: 'text-emerald-300',
  expiring_soon: 'text-amber-300',
  grace: 'text-orange-300',
  past_due: 'text-rose-300',
}

function formatEnd(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Parc admin : abonnements actifs + à risque, filtre / tri + raccourcis. */
export function AdminSubscriptionsPanel({
  onOpenUser,
  onOpenPlace,
}: {
  onOpenUser: (userId: number) => void
  onOpenPlace: (communityId: number) => void
}) {
  const [family, setFamily] = useState<FamilyFilter>('all')
  const [sort, setSort] = useState<SortKey>('urgency')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [items, setItems] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [extendBusyId, setExtendBusyId] = useState<number | null>(null)
  const [extendMsg, setExtendMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await billingApi.listAdminSubscriptions({ family, sort, order })
      setItems(res.items ?? [])
    } catch (e: unknown) {
      setItems([])
      setError(e instanceof Error ? e.message : 'Impossible de charger le parc')
    } finally {
      setLoading(false)
    }
  }, [family, sort, order])

  useEffect(() => {
    void load()
  }, [load])

  async function extendComp(row: SubRow, months: number) {
    if (!row.community_id) return
    setExtendBusyId(row.id)
    setExtendMsg(null)
    try {
      const res = await billingApi.grantPlaceComp({
        months,
        community_ids: [row.community_id],
      })
      const g = res.granted?.[0]
      if (!g?.ok) {
        setExtendMsg(g?.error || 'Échec de la prolongation')
        return
      }
      setExtendMsg(`+${months} mois pour « ${row.target_label} ».`)
      await load()
    } catch (e: unknown) {
      setExtendMsg(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setExtendBusyId(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Parc d’abonnements</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Actifs et à risque (bientôt, grâce cadeau, impayé). Cadeaux / Stripe / Play —
            Lieu et Mandala Pro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-slate-400 space-y-1">
          <span className="block">Famille</span>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as FamilyFilter)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="all">Toutes</option>
            <option value="place">Lieu</option>
            <option value="pro">Mandala Pro</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          <span className="block">Trier par</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="urgency">Urgence</option>
            <option value="period_end">Fin de période</option>
            <option value="family">Famille</option>
            <option value="target">Cible</option>
            <option value="provider">Provider</option>
            <option value="updated_at">Mis à jour</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          <span className="block">Ordre</span>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value === 'desc' ? 'desc' : 'asc')}
            className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="asc">Croissant</option>
            <option value="desc">Décroissant</option>
          </select>
        </label>
        <p className="text-xs text-slate-500 self-center sm:ml-auto">
          {loading ? 'Chargement…' : `${items.length} abonnement${items.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {extendMsg && <p className="text-sm text-amber-200">{extendMsg}</p>}

      {!loading && items.length === 0 && !error ? (
        <p className="text-sm text-slate-500">Aucun abonnement actif ou à risque.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="text-left p-2">Cible</th>
                <th className="text-left p-2">Offre</th>
                <th className="text-left p-2">Statut</th>
                <th className="text-left p-2">Provider</th>
                <th className="text-left p-2">Fin</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const ops = row.ops_status as AdminBillingOpsStatus
                const providerLabel =
                  PROVIDER_LABELS[row.payment_provider] ?? row.payment_provider
                const isCompPlace =
                  row.plan_family === 'place' &&
                  row.payment_provider === 'comp' &&
                  row.community_id != null
                return (
                  <tr
                    key={row.id}
                    className="border-t border-slate-800 hover:bg-slate-950/60 align-top"
                  >
                    <td className="p-2 text-slate-200">
                      <div className="font-medium">{row.target_label}</div>
                      <div className="text-slate-500 mt-0.5">
                        {row.plan_family === 'place'
                          ? `Lieu #${row.community_id ?? '—'}`
                          : row.user_email || `#${row.user_id}`}
                      </div>
                      {row.billing_partner && (
                        <span className="inline-block mt-1 text-[10px] text-sky-300">
                          Partner
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-slate-300">
                      <div>{row.plan_family === 'place' ? 'Lieu' : 'Pro'}</div>
                      <div className="text-slate-500">{row.plan_id}</div>
                    </td>
                    <td className="p-2">
                      <span className={OPS_CLASS[ops]}>
                        {ADMIN_BILLING_OPS_LABELS[ops] ?? ops}
                      </span>
                      <div className="text-slate-500 mt-0.5">{row.status}</div>
                      {row.cancel_at_period_end && (
                        <div className="text-amber-400/90 mt-0.5">Fin de période</div>
                      )}
                    </td>
                    <td className="p-2 text-slate-300">{providerLabel}</td>
                    <td className="p-2 text-slate-300 whitespace-nowrap">
                      {formatEnd(row.current_period_end)}
                    </td>
                    <td className="p-2 space-y-1">
                      {row.plan_family === 'pro' && (
                        <button
                          type="button"
                          onClick={() => onOpenUser(row.user_id)}
                          className="block text-violet-300 hover:text-violet-200"
                        >
                          Fiche personne →
                        </button>
                      )}
                      {row.plan_family === 'place' && row.community_id != null && (
                        <button
                          type="button"
                          onClick={() => onOpenPlace(row.community_id!)}
                          className="block text-violet-300 hover:text-violet-200"
                        >
                          Fiche lieu →
                        </button>
                      )}
                      {row.plan_family === 'place' && row.user_id > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenUser(row.user_id)}
                          className="block text-slate-400 hover:text-slate-200"
                        >
                          Payeur →
                        </button>
                      )}
                      {isCompPlace && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {[1, 3, 6].map((m) => (
                            <button
                              key={m}
                              type="button"
                              disabled={extendBusyId === row.id}
                              onClick={() => void extendComp(row, m)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-amber-700/60 text-amber-200 disabled:opacity-40"
                              title={`Prolonger de ${m} mois`}
                            >
                              +{m} mo
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
