'use client'

import { useCallback, useEffect, useState } from 'react'
import { placeLinksApi, type ManagedPlaceOption } from '@/api/place-links'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api-client'

/**
 * Proposition de lien lieu → lieu sur une fiche (carte / Découvrir / profil).
 * Porte `lieux_lies`. Un seul lieu source → envoi immédiat ; plusieurs → une question.
 * Si la cible est aussi gérée par l’utilisateur, le lien est accepté tout de suite côté API.
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
  const [targetIsManaged, setTargetIsManaged] = useState(false)
  const [status, setStatus] = useState<'none' | 'pending' | 'accepted' | string>('none')
  const [managed, setManaged] = useState<ManagedPlaceOption[]>([])
  const [targetFriends, setTargetFriends] = useState<Array<{ id: number; name: string }>>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || !targetCommunityId) {
      setCanLink(false)
      setTargetIsManaged(false)
      setManaged([])
      setTargetFriends([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await placeLinksApi.statusToward(targetCommunityId)
      setCanLink(Boolean(res.can_link))
      setTargetIsManaged(Boolean(res.target_is_managed))
      setStatus(res.status || 'none')
      setManaged(res.managed || [])
      try {
        const fr = await placeLinksApi.friendsOf(targetCommunityId)
        setTargetFriends(
          fr.can_view
            ? (fr.friends ?? []).map((f) => ({ id: f.id, name: f.name }))
            : []
        )
      } catch {
        setTargetFriends([])
      }
    } catch {
      setCanLink(false)
      setTargetIsManaged(false)
      setManaged([])
      setTargetFriends([])
    } finally {
      setLoading(false)
    }
  }, [user, targetCommunityId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const soleManaged = managed.length === 1 ? managed[0] : null

  async function sendFrom(fromId: number) {
    const fromName = managed.find((m) => m.id === fromId)?.name ?? 'votre lieu'
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await placeLinksApi.request(fromId, targetCommunityId)
      setPickOpen(false)
      const link = res.link as { status?: string } | undefined
      if (link?.status === 'accepted' || targetIsManaged) {
        setMsg(`${fromName} et ${targetName} sont maintenant lieux amis.`)
      } else {
        setMsg(
          `Demande envoyée depuis ${fromName} vers ${targetName}. Les gestionnaires de ${targetName} pourront accepter dans leurs alertes.`
        )
      }
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

  if (!user || loading) return null

  // Un seul lieu géré = la cible : rien à relier depuis un autre de vos lieux.
  if (!canLink && targetIsManaged) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        C’est votre seul lieu géré ici. Pour le relier, il faut un autre lieu dont vous êtes
        gestionnaire — ou ouvrez la fiche d’un lieu que vous ne gérez pas et proposez le lien
        depuis là.
      </p>
    )
  }

  if (!canLink) return null

  if (status === 'accepted') {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-emerald-400/90 font-medium">
          {targetName} — lieux déjà reliés
          {soleManaged ? ` (lien via ${soleManaged.name})` : ''}
        </p>
        {targetFriends.length > 0 ? (
          <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
            {targetFriends.map((f) => (
              <li key={f.id}>{f.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">Aucun autre lieu ami listé pour l’instant.</p>
        )}
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <p className="text-xs text-amber-300/90">
        Demande en cours — en attente des gestionnaires de {targetName}.
      </p>
    )
  }

  const buttonLabel = soleManaged
    ? `Relier ${soleManaged.name} à ${targetName}`
    : `Relier un de mes lieux à ${targetName}…`

  const helpText = targetIsManaged
    ? 'Vous gérez les deux lieux : le lien sera créé immédiatement.'
    : `Une demande sera envoyée aux gestionnaires de ${targetName}.`

  return (
    <div className="space-y-2">
      {targetFriends.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Déjà relié à :</p>
          <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
            {targetFriends.map((f) => (
              <li key={f.id}>{f.name}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onRelierClick}
        className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border border-amber-600/50 text-amber-100 hover:bg-amber-950/40 font-medium disabled:opacity-40"
      >
        {buttonLabel}
      </button>
      <p className="text-xs text-slate-500 leading-relaxed">{helpText}</p>

      {pickOpen && managed.length > 1 && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/90 p-3 space-y-2">
          <p className="text-xs text-slate-400">
            Quel de vos lieux souhaitez-vous relier à {targetName} ?
          </p>
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
