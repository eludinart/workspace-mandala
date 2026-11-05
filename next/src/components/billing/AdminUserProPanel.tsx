'use client'

import { useCallback, useEffect, useState } from 'react'
import { billingApi } from '@/api/billing'
import { ApiError } from '@/lib/api-client'

type ProSnap = {
  verification: string
  pro_boost: boolean
  pro_verified: boolean
  tagline: string | null
  subscription: {
    plan_id: string
    status: string
    payment_provider: string
    current_period_end: string | null
    is_admin_comp: boolean
  } | null
}

function formatEnd(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Admin app : forcer / offrir Mandala Pro sur une personne. */
export function AdminUserProPanel({ userId }: { userId: number }) {
  const [snap, setSnap] = useState<ProSnap | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(6)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billingApi.getProComp(userId)
      setSnap(res.pro as ProSnap)
    } catch {
      setSnap(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function grant() {
    if (![1, 2, 3, 4, 5, 6].includes(months)) {
      setOk(false)
      setMsg('Choisissez 1 à 6 mois.')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await billingApi.grantProComp({ user_id: userId, months })
      setSnap(res.pro as ProSnap)
      const end = formatEnd(
        (res.pro as ProSnap).subscription?.current_period_end ?? null
      )
      setOk(true)
      setMsg(
        end
          ? `Mandala Pro activé / prolongé de ${months} mois jusqu’au ${end}.`
          : `Mandala Pro activé pour ${months} mois.`
      )
    } catch (e: unknown) {
      setOk(false)
      setMsg(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await billingApi.revokeProComp(userId)
      setSnap(res.pro as ProSnap)
      setOk(true)
      setMsg(
        res.revoked
          ? 'Cadeau / forçage Pro retiré.'
          : 'Profil Pro remis à « non vérifié » (pas de cadeau admin actif).'
      )
    } catch (e: unknown) {
      setOk(false)
      setMsg(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="space-y-2 border-t border-slate-800 pt-4">
        <h3 className="text-xs uppercase tracking-widest text-amber-300">Mandala Pro</h3>
        <p className="text-xs text-slate-500">Chargement…</p>
      </section>
    )
  }

  const endLabel = formatEnd(snap?.subscription?.current_period_end)
  const isPro = Boolean(snap?.pro_boost || snap?.pro_verified)

  return (
    <section className="space-y-3 border-t border-amber-900/40 pt-4">
      <h3 className="text-xs uppercase tracking-widest text-amber-300">Mandala Pro</h3>
      <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-slate-300 space-y-1">
        <p>
          Statut :{' '}
          <span className={isPro ? 'text-amber-200 font-medium' : 'text-slate-400'}>
            {snap?.pro_verified
              ? 'Pro vérifié'
              : snap?.pro_boost
                ? 'Abo Pro actif (non vérifié)'
                : 'Pas Pro'}
          </span>
          {snap?.verification && snap.verification !== 'none' && (
            <span className="text-slate-500"> · vérif. {snap.verification}</span>
          )}
        </p>
        {snap?.subscription && (
          <p className="text-slate-400">
            Abo {snap.subscription.plan_id} · {snap.subscription.status}
            {snap.subscription.is_admin_comp ? ' · cadeau admin' : ''}
            {endLabel ? ` · jusqu’au ${endLabel}` : ''}
          </p>
        )}
        <p className="text-slate-500 leading-relaxed">
          Choisir une durée, puis offrir : active un abonnement Pro cadeau pour cette personne
          et marque le profil comme vérifié. Ne remplace pas un abo Stripe / Play déjà en cours.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">Durée du cadeau</p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Durée du cadeau Pro en mois"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => setMonths(n)}
              className={`min-w-[2.5rem] px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                months === n
                  ? 'bg-amber-600 text-slate-950 border-amber-500'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {n} mo
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void grant()}
            className="rounded-lg bg-amber-600/90 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {busy ? '…' : isPro ? `Offrir ${months} mois de plus` : `Offrir Pro · ${months} mois`}
          </button>
          {(snap?.subscription?.is_admin_comp || snap?.pro_verified) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void revoke()}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Retirer le forçage
            </button>
          )}
        </div>
      </div>
      {msg && (
        <p className={`text-xs ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>
      )}
    </section>
  )
}
