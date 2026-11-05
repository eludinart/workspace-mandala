'use client'

import { useCallback, useEffect, useState } from 'react'
import { billingApi } from '@/api/billing'

type PendingRow = {
  user_id: number
  tagline?: string | null
  verification?: string
  submitted_at?: string | null
}

/** File d’endossement Mandala Pro — visible seulement s’il y a des demandes (ou une erreur). */
export function ProEndorseQueue() {
  const [pending, setPending] = useState<PendingRow[]>([])
  const [scope, setScope] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await billingApi.listPendingPro()
      setPending((res.pending as PendingRow[]) || [])
      setScope(res.scope || '')
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status
      if (status === 403) {
        setPending([])
        setScope('')
        return
      }
      setError(e instanceof Error ? e.message : 'Impossible de charger la file')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(userId: number, decision: 'verified' | 'rejected') {
    setBusyId(userId)
    setError('')
    try {
      await billingApi.reviewPro(userId, {
        decision,
        reason: decision === 'rejected' ? reason : undefined,
      })
      setReason('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setBusyId(null)
    }
  }

  if (!loaded) return null
  if (!error && pending.length === 0) return null

  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Endosser Mandala Pro</h3>
        <p className="text-xs text-slate-500 mt-1">
          Valider le badge Pro (après paiement + soumission de fiche).{' '}
          {scope === 'admin'
            ? 'File globale administrateur.'
            : 'Membres de vos lieux en attente.'}
        </p>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {pending.length > 0 && (
        <>
          <ul className="space-y-3">
            {pending.map((p) => (
              <li
                key={p.user_id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2"
              >
                <p className="text-sm text-slate-200">
                  Utilisateur #{p.user_id}
                  {p.tagline ? ` — ${p.tagline}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === p.user_id}
                    onClick={() => void decide(p.user_id, 'verified')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-700 text-white disabled:opacity-40"
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.user_id}
                    onClick={() => void decide(p.user_id, 'rejected')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-rose-800 text-white disabled:opacity-40"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <label className="block text-xs text-slate-500">
            Motif de refus (optionnel)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </>
      )}
    </section>
  )
}
