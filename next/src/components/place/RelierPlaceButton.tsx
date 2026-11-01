'use client'

import { useCallback, useEffect, useState } from 'react'
import { placeLinksApi, type ManagedPlaceOption } from '@/api/place-links'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api-client'

/**
 * « Relier à … » sur une fiche lieu (carte / Découvrir).
 * Porte `lieux_lies`. Un seul lieu géré → envoi immédiat ; plusieurs → une question.
 */
export function RelierPlaceButton({
  targetCommunityId,
  targetName,
}: {
  targetCommunityId: number
  targetName: string
}) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [canLink, setCanLink] = useState(false)
  const [status, setStatus] = useState<'none' | 'pending' | 'accepted' | string>('none')
  const [managed, setManaged] = useState<ManagedPlaceOption[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || !targetCommunityId) {
      setCanLink(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await placeLinksApi.statusToward(targetCommunityId)
      setCanLink(Boolean(res.can_link))
      setStatus(res.status || 'none')
      setManaged(res.managed || [])
    } catch {
      setCanLink(false)
      setManaged([])
    } finally {
      setLoading(false)
    }
  }, [user, targetCommunityId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function sendFrom(fromId: number) {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await placeLinksApi.request(fromId, targetCommunityId)
      setPickOpen(false)
      setMsg('Demande envoyée. Les gestionnaires de l’autre lieu la verront dans leurs alertes.')
      await refresh()
    } catch (e: unknown) {
      const detail = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Échec'
      setErr(detail)
    } finally {
      setBusy(false)
    }
  }

  function onRelierClick() {
    setErr(null)
    setMsg(null)
    if (managed.length === 1) {
      void sendFrom(managed[0].id)
      return
    }
    if (managed.length > 1) {
      setPickOpen(true)
    }
  }

  if (!user || loading || !canLink) return null

  if (status === 'accepted') {
    return (
      <p className="text-xs text-emerald-400/90">Lieu déjà relié à l’un de vos lieux.</p>
    )
  }

  if (status === 'pending') {
    return (
      <p className="text-xs text-amber-300/90">Demande de lien en cours…</p>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={onRelierClick}
        className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border border-amber-600/50 text-amber-100 hover:bg-amber-950/40 font-medium disabled:opacity-40"
      >
        Relier à {targetName}…
      </button>

      {pickOpen && managed.length > 1 && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/90 p-3 space-y-2">
          <p className="text-xs text-slate-400">Quel lieu souhaitez-vous relier ?</p>
          <ul className="space-y-1.5">
            {managed.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendFrom(m.id)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border border-slate-700 hover:border-violet-500/50 text-slate-200 disabled:opacity-40"
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={() => setPickOpen(false)}
          >
            Annuler
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  )
}
