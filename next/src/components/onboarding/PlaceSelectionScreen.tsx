'use client'

import { useCallback, useEffect, useState } from 'react'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { CommunityAvatar } from '@/components/CommunityAvatar'

type Props = {
  title?: string
  subtitle?: string
  onComplete: (slug: string, inviteCode?: string | null) => Promise<void>
  initialSlug?: string | null
}

export function PlaceSelectionScreen({
  title = 'Choisissez votre lieu',
  subtitle = 'Sélectionnez au moins un lieu pour rejoindre la communauté Mandala.',
  onComplete,
  initialSlug = null,
}: Props) {
  const [places, setPlaces] = useState<PublicCommunityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug)
  const [inviteCode, setInviteCode] = useState('')
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

  const selected = places.find((p) => p.slug === selectedSlug) ?? null
  const needsInvite = !selected || selected.join_mode !== 'open'

  const submit = useCallback(async () => {
    if (!selectedSlug || !selected) {
      setError('Veuillez sélectionner un lieu.')
      return
    }
    if (selected.join_mode === 'closed') {
      setError('Ce lieu n’accepte pas les adhésions libres.')
      return
    }
    if (selected.join_mode === 'invite' && !inviteCode.trim()) {
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
  }, [inviteCode, onComplete, selected, selectedSlug])

  return (
    <div className="w-full max-w-lg space-y-5">
      <header className="text-center space-y-2">
        <p className="text-2xl font-bold">Mandala</p>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </header>

      {loading && <p className="text-sm text-slate-500 text-center py-8">Chargement des lieux…</p>}

      {!loading && places.length === 0 && (
        <p className="text-sm text-amber-300/90 text-center py-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4">
          Aucun lieu n&apos;est disponible pour le moment. Réessayez plus tard ou contactez
          l&apos;équipe.
        </p>
      )}

      {!loading && places.length > 0 && (
        <ul className="space-y-3 max-h-[min(52vh,28rem)] overflow-y-auto pr-1">
          {places.map((place) => {
            const selected = selectedSlug === place.slug
            return (
              <li key={place.slug}>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(place.slug)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    selected
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
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-slate-100">{place.name}</p>
                      {place.tagline && (
                        <p className="text-xs text-violet-300/80">{place.tagline}</p>
                      )}
                      {place.location && (
                        <p className="text-xs text-slate-500">📍 {place.location}</p>
                      )}
                      {place.description ? (
                        <p className="text-sm text-slate-400 leading-relaxed mt-2 line-clamp-4">
                          {place.description}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500 italic mt-2">Description à venir.</p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {needsInvite && selected && selected.join_mode !== 'closed' && (
        <label className="block space-y-1">
          <span className="text-xs text-slate-400">Code d’invitation</span>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Ex. A1B2C3D4"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm tracking-widest uppercase"
            autoComplete="off"
          />
        </label>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      <button
        type="button"
        disabled={
          submitting ||
          !selectedSlug ||
          places.length === 0 ||
          selected?.join_mode === 'closed'
        }
        onClick={() => void submit()}
        className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 font-semibold disabled:opacity-50"
      >
        {submitting ? '…' : 'Continuer avec ce lieu'}
      </button>
    </div>
  )
}
