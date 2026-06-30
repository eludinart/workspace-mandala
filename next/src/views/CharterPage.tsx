'use client'

import { useCallback, useEffect, useState } from 'react'
import { communitiesApi, type MemberCharterView } from '@/api/communities'
import { useCommunity } from '@/contexts/CommunityContext'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { CharterPreview } from '@/components/place/CharterEditor'

function formatAcceptedAt(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso.replace(' ', 'T'))
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function CharterPage() {
  const { active } = useCommunity()
  const [data, setData] = useState<MemberCharterView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await communitiesApi.getCharter(active.slug)
      setData(res.charter)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Impossible de charger la charte.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void load()
  }, [load])

  if (!active) {
    return <p className="text-sm text-slate-400">Sélectionnez un lieu pour consulter sa charte.</p>
  }

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex gap-4 items-start">
        <CommunityAvatar
          avatar={active.avatar}
          logoEmoji={active.logo_emoji}
          accentColor={active.accent_color}
          size="lg"
          alt={active.name}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Charte — {active.name}</h1>
          {active.tagline && <p className="text-sm text-slate-400 mt-1">{active.tagline}</p>}
          {data?.accepted && data.accepted_at && (
            <p className="text-xs text-emerald-400/90 mt-2">
              Acceptée le {formatAcceptedAt(data.accepted_at)}
            </p>
          )}
          {data?.requires_acceptance && (
            <p className="text-xs text-amber-400/90 mt-2">
              La charte a été mise à jour — une nouvelle validation sera demandée à la prochaine
              connexion.
            </p>
          )}
        </div>
      </header>

      {loading && <p className="text-sm text-slate-500">Chargement…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && data && (
        <article className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
          <CharterPreview blocks={data.charter} />
        </article>
      )}
    </div>
  )
}
