'use client'

import { useCallback, useEffect, useState } from 'react'
import { returnsApi, type Inbox } from '@/api/returns'
import { ApiError } from '@/lib/api-client'
import { WriteSlotForm } from '@/components/returns/ReturnsBlock'

export function MyEvaluationsSection() {
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [writing, setWriting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await returnsApi.mine()
      setInbox(data)
      setOpen(data.returns_open)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Impossible de charger les évaluations')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(next: boolean) {
    setOpen(next)
    setInfo(null)
    try {
      const res = await returnsApi.setOptIn(next)
      setOpen(res.open)
    } catch (err: unknown) {
      setOpen(!next)
      setError(err instanceof ApiError ? err.detail : 'Enregistrement impossible')
    }
  }

  async function respond(id: number, action: 'accept' | 'decline') {
    setInfo(null)
    try {
      await returnsApi.respond(id, action)
      setInfo(action === 'accept' ? 'Moment accepté. Vous pouvez écrire un retour.' : 'Demande refusée.')
      await load()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Réponse impossible')
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
      <label className="flex items-start gap-3 text-sm text-slate-200">
        <input
          type="checkbox"
          className="mt-1"
          checked={open}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span>
          J’accepte les retours sur ce que je propose.
          <span className="block text-xs text-slate-500 mt-1">
            Une personne présente peut vous désigner. Vous acceptez, puis chacun peut écrire. Tant que la case est décochée, aucune nouvelle demande n’arrive.
          </span>
        </span>
      </label>

      {inbox && inbox.incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-200">Demandes reçues</h3>
          <ul className="space-y-2">
            {inbox.incoming.map((card) => (
              <li key={card.id} className="rounded-lg border border-slate-800 px-3 py-2 text-sm space-y-2">
                <p>
                  {card.other_name} indique un moment passé avec vous · {card.occasion_label}
                  <span className="text-slate-500"> · {card.community_name}</span>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void respond(card.id, 'accept')} className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white">
                    Accepter
                  </button>
                  <button type="button" onClick={() => void respond(card.id, 'decline')} className="text-xs px-3 py-1.5 rounded-lg border border-slate-600">
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inbox && inbox.outgoing.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-slate-200">Demandes envoyées</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            {inbox.outgoing.map((card) => (
              <li key={card.id}>
                En attente de {card.other_name} · {card.occasion_label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {inbox && inbox.to_write.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-200">Retours à écrire</h3>
          {inbox.to_write.map((slot) => {
            const key = `${slot.kind}:${slot.accompaniment_id}:${slot.event_id}:${slot.community_slug}:${slot.occasion_date}`
            return (
              <div key={key}>
                {writing !== key ? (
                  <button type="button" onClick={() => setWriting(key)} className="text-sm text-violet-300 hover:underline">
                    {slot.occasion_label}
                    {slot.other_name ? ` · ${slot.other_name}` : ''} · {slot.community_name}
                  </button>
                ) : (
                  <WriteSlotForm
                    slot={slot}
                    onDone={() => {
                      setWriting(null)
                      void load()
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {inbox && inbox.incoming.length === 0 && inbox.outgoing.length === 0 && inbox.to_write.length === 0 && (
        <p className="text-sm text-slate-500">
          Après une présence passée, le retour sur le lieu ou l’événement se rédige depuis la fiche. Pour une personne, désignez-la depuis sa fiche.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}
    </div>
  )
}
