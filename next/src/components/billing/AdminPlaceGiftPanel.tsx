'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, type CommunityAdmin } from '@/api/admin'
import { billingApi } from '@/api/billing'

/** Admin : offrir N mois d’abonnement Lieu (cadeau / comp) à un lieu. */
export function AdminPlaceGiftPanel() {
  const [places, setPlaces] = useState<CommunityAdmin[]>([])
  const [communityId, setCommunityId] = useState<number | ''>('')
  const [months, setMonths] = useState(6)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await adminApi.communities.list()
      setPlaces(data.items ?? [])
    } catch {
      setPlaces([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function grant() {
    const id = Number(communityId)
    if (!id) {
      setOk(false)
      setMsg('Choisissez un lieu.')
      return
    }
    if (!Number.isFinite(months) || months < 1 || months > 36) {
      setOk(false)
      setMsg('Durée entre 1 et 36 mois.')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await billingApi.grantPlaceComp({
        months,
        community_ids: [id],
      })
      const row = res.granted?.[0]
      if (!row?.ok) {
        setOk(false)
        setMsg(row?.error || 'Échec du cadeau')
        return
      }
      const end = row.place?.currentPeriodEnd ?? row.place?.current_period_end
      const endLabel =
        end != null
          ? new Date(String(end)).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : null
      setOk(true)
      setMsg(
        endLabel
          ? `Cadeau ${months} mois activé jusqu’au ${endLabel} (+ 7 j de grâce).`
          : `Cadeau ${months} mois activé.`
      )
    } catch (e: unknown) {
      setOk(false)
      setMsg(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-amber-700/40 bg-slate-900/70 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-amber-200">Cadeau abonnement Lieu</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Offre un nombre de mois (hors Stripe). Alerte 7 jours avant la fin, puis 7 jours de
        grâce — mail + bannière in-app pour les gestionnaires.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          value={communityId === '' ? '' : String(communityId)}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            setCommunityId(Number.isFinite(n) ? n : '')
          }}
        >
          <option value="">Choisir un lieu…</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300 shrink-0">
          <span className="text-xs text-slate-500">Mois</span>
          <input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value, 10) || 1)}
            className="w-20 rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void grant()}
          className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {busy ? '…' : 'Offrir'}
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>
      )}
    </section>
  )
}
