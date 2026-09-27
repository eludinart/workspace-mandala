'use client'

import { useCallback, useEffect, useState } from 'react'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { CommunityAvatar } from '@/components/CommunityAvatar'

type Props = {
  title?: string
  subtitle?: string
  onComplete: (slug: string, inviteCode?: string | null) => Promise<void>
  initialSlug?: string | null
  initialInviteCode?: string | null
}

export function PlaceSelectionScreen({
  title = 'Choisissez votre lieu',
  subtitle = 'Sélectionnez au moins un lieu pour rejoindre la communauté Mandala.',
  onComplete,
  initialSlug = null,
  initialInviteCode = null,
}: Props) {
  const [places, setPlaces] = useState<PublicCommunityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug)
  const [inviteCode, setInviteCode] = useState(initialInviteCode ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    void communitiesApi
      .publicList()
      .then((res) => setPlaces(res.items ?? []))
      .catch(() => setPlaces([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (initialSlug) setSelectedSlug(initialSlug)
    if (initialInviteCode) setInviteCode(initialInviteCode)
  }, [initialInviteCode, initialSlug])

  const selected = places.find((p) => p.slug === selectedSlug) ?? null
  const inviteOnly = !!initialSlug && !selected && !loading
  const needsInvite = inviteOnly || selected?.join_mode === 'invite'

  const submit = useCallback(async () => {
    if (!selectedSlug) {
      setError('Veuillez sélectionner un lieu.')
      return
    }
    if (selected?.join_mode === 'closed') {
      setError('Ce lieu n’accepte pas les adhésions libres.')
      return
    }
    if ((inviteOnly || selected?.join_mode === 'invite') && !inviteCode.trim()) {
      setError('Code d’invitation requis pour ce lieu.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onComplete(selectedSlug, inviteCode.trim() || null)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Impossible de rejoindre ce lieu.')
    } finally {
      setSubmitting(false)
    }
  }, [inviteCode, inviteOnly, onComplete, selected, selectedSlug])

  return (
    <div className="m-user-form w-full max-w-3xl space-y-5">
      <header className="text-center space-y-2">
        <p className="m-user-title text-4xl">Mandala</p>
        <p className="m-user-eyebrow">Bienvenue</p>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </header>

      {loading && <p className="text-sm text-slate-500 text-center py-8">Chargement des lieux…</p>}

      {inviteOnly && (
        <div className="rounded-xl border border-violet-700/50 bg-violet-950/30 p-4 space-y-2">
          <p className="text-sm text-violet-100 font-medium">Lieu privé · {initialSlug}</p>
          <p className="text-xs text-slate-400">
            Ce lieu n’apparaît pas dans le catalogue public. Utilisez le code reçu pour le rejoindre.
          </p>
        </div>
      )}

      {!loading && !inviteOnly && places.length === 0 && (
        <p className="text-sm text-amber-300/90 text-center py-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4">
          Aucun lieu n&apos;est disponible pour le moment. Réessayez plus tard ou contactez
          l&apos;équipe.
        </p>
      )}

      {!loading && places.length > 0 && (
        <ul className="space-y-3 max-h-[min(52svh,28rem)] overflow-y-auto pr-1">
          {places.map((place) => {
            const isSelected = selectedSlug === place.slug
            return (
              <li key={place.slug}>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(place.slug)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-violet-500/60 bg-violet-950/40 ring-1 ring-violet-500/30'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <CommunityAvatar
                      avatar={place.avatar}
                      logoEmoji={place.logo_emoji}
                      accentColor={place.accent_color}
                      size="md"
                      alt={place.name}
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-100 block">{place.name}</span>
                      {place.tagline && (
                        <span className="text-xs text-slate-500 block mt-0.5">{place.tagline}</span>
                      )}
                      {place.join_mode === 'invite' && (
                        <span className="text-[10px] uppercase tracking-widest text-amber-300/90 mt-1 block">
                          Sur invitation
                        </span>
                      )}
                      {place.join_mode === 'closed' && (
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 block">
                          Fermé
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {needsInvite && selectedSlug && selected?.join_mode !== 'closed' && (
        <label className="block space-y-1">
          <span className="text-xs text-slate-400">Code d’invitation</span>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm font-mono tracking-widest"
            placeholder="CODE"
            autoCapitalize="characters"
          />
        </label>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      <button
        type="button"
        disabled={
          submitting ||
          !selectedSlug ||
          selected?.join_mode === 'closed' ||
          (needsInvite && !inviteCode.trim())
        }
        onClick={() => void submit()}
        className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-semibold disabled:opacity-50"
      >
        {submitting
          ? '…'
          : selected?.join_mode === 'closed'
            ? 'Lieu fermé'
            : 'Rejoindre ce lieu'}
      </button>
    </div>
  )
}
