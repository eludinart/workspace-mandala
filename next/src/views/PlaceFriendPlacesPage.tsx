'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { PlaceOrgBackLink } from '@/components/place/PlaceOrgBackLink'
import { managerApi, type PlaceFriendLink } from '@/api/manager'
import { useCommunity } from '@/contexts/CommunityContext'
import { useManagedPlaces } from '@/hooks/useManagedPlaces'
import { useNavAccess } from '@/hooks/useNavAccess'
import { ApiError } from '@/lib/api-client'

export function PlaceFriendPlacesPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { active } = useCommunity()
  const { canManageActiveCommunity, loadingManagedPlaces } = useNavAccess()
  const { managedPlaces } = useManagedPlaces()
  const communityId =
    active?.id ?? managedPlaces.find((p) => p.slug === active?.slug)?.id ?? null

  const [items, setItems] = useState<PlaceFriendLink[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!communityId) return
    setLoading(true)
    setErr(null)
    setForbidden(false)
    try {
      const res = await managerApi.communities.friendPlaces(communityId)
      setItems(res.items ?? [])
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true)
        setItems([])
      } else {
        setErr(e instanceof ApiError ? e.detail : 'Impossible de charger les lieux amis')
        setItems([])
      }
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    void load()
  }, [load])

  if (loadingManagedPlaces) {
    return <p className="text-sm text-slate-400">Chargement…</p>
  }

  if (!active || !canManageActiveCommunity) {
    return (
      <div className="max-w-lg rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-2">
        <h1 className="text-xl font-bold">Lieux amis</h1>
        <p className="text-sm text-slate-400">
          Sélectionnez un lieu dont vous êtes gestionnaire via « Mes lieux ».
        </p>
      </div>
    )
  }

  const accepted = items.filter((i) => i.status === 'accepted')
  const pending = items.filter((i) => i.status === 'pending')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {onNavigate && active.slug && (
        <PlaceOrgBackLink onNavigate={onNavigate} hubSlug={active.slug} />
      )}

      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-sky-400/90 font-semibold">
          Organisation
        </p>
        <h1 className="text-2xl font-bold">Lieux amis</h1>
        <p className="text-sm text-slate-400">
          {active.name} — lieux reliés et demandes en cours.
        </p>
      </header>

      {forbidden && (
        <p className="text-sm rounded-lg px-3 py-2 bg-slate-900/80 text-slate-400 border border-slate-800">
          Cette fonction n’est pas ouverte pour votre compte (porte « lieux reliés »).
        </p>
      )}

      {err && (
        <p className="text-sm rounded-lg px-3 py-2 bg-red-950/50 text-red-200">{err}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : forbidden ? null : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Reliés ({accepted.length})
            </h2>
            {accepted.length === 0 ? (
              <p className="text-sm text-slate-500 leading-relaxed">
                Aucun lieu ami pour l’instant. Sur Découvrir ou la fiche d’un autre lieu, utilisez
                « Proposer un lien… ».
              </p>
            ) : (
              <ul className="space-y-2">
                {accepted.map((item) => (
                  <FriendRow key={item.link_id} item={item} onNavigate={onNavigate} />
                ))}
              </ul>
            )}
          </section>

          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Demandes en cours ({pending.length})
              </h2>
              <ul className="space-y-2">
                {pending.map((item) => (
                  <FriendRow key={item.link_id} item={item} onNavigate={onNavigate} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function FriendRow({
  item,
  onNavigate,
}: {
  item: PlaceFriendLink
  onNavigate?: MandalaNavigate
}) {
  const { other, status, we_requested } = item
  const statusLabel =
    status === 'accepted'
      ? 'Lieu ami'
      : we_requested
        ? 'Demande envoyée — en attente'
        : 'Demande reçue — voir Alertes'

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
      <CommunityAvatar
        avatar={null}
        logoEmoji={other.logo_emoji}
        accentColor={other.accent_color}
        size="md"
        alt={other.name}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100 truncate">{other.name}</p>
        <p
          className={`text-xs mt-0.5 ${
            status === 'accepted' ? 'text-emerald-400/90' : 'text-amber-300/90'
          }`}
        >
          {statusLabel}
        </p>
      </div>
      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate('places-map')}
          className="text-xs text-violet-300 hover:underline shrink-0"
        >
          Découvrir
        </button>
      )}
      <a
        href={`/lieux/${encodeURIComponent(other.slug)}`}
        className="text-xs text-slate-400 hover:text-slate-200 shrink-0"
      >
        Fiche →
      </a>
    </li>
  )
}
