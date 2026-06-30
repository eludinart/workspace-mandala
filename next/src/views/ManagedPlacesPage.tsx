'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'
import { PlaceManageHub } from '@/components/place/PlaceManageHub'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { useManagedPlaces } from '@/hooks/useManagedPlaces'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'

export function ManagedPlacesPage({
  hubSlug,
  onHubSlugChange,
  onNavigate,
}: {
  hubSlug: string | null
  onHubSlugChange: (slug: string | null) => void
  onNavigate: MandalaNavigate
}) {
  const { actingRole, isRealAdmin } = useAuth()
  const { setActiveSlug } = useCommunity()
  const { managedPlaces, loadingManagedPlaces } = useManagedPlaces()

  const simulatingMember = isRealAdmin && actingRole === 'user'
  const hubPlace = hubSlug ? managedPlaces.find((p) => p.slug === hubSlug) ?? null : null

  const openHub = (slug: string) => {
    setActiveSlug(slug)
    onHubSlugChange(slug)
  }

  if (loadingManagedPlaces) {
    return (
      <div className="max-w-lg space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h1 className="text-xl font-bold">Mes lieux</h1>
        <p className="text-sm text-slate-400">Chargement de vos lieux gérés…</p>
      </div>
    )
  }

  if (simulatingMember) {
    return (
      <div className="max-w-lg space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h1 className="text-xl font-bold">Mes lieux</h1>
        <p className="text-sm text-slate-400">
          Vue « Utilisateur » active — repassez en Administrateur ou Gestionnaire pour accéder à cette
          page.
        </p>
      </div>
    )
  }

  if (hubSlug && hubPlace) {
    return (
      <div className="max-w-2xl">
        <PlaceManageHub
          place={hubPlace}
          onBack={() => onHubSlugChange(null)}
          onNavigate={onNavigate}
        />
      </div>
    )
  }

  if (managedPlaces.length === 0) {
    return (
      <div className="max-w-lg space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h1 className="text-xl font-bold">Mes lieux</h1>
        <p className="text-sm text-slate-400">
          Vous n&apos;êtes gestionnaire d&apos;aucun lieu pour le moment. Demandez à un
          administrateur de vous attribuer le rôle <strong className="text-slate-300">gestionnaire</strong>{' '}
          sur une communauté existante.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Mes lieux</h1>
        <p className="text-sm text-slate-400">
          Sélectionnez un lieu pour administrer son profil, sa charte, ses membres et son
          calendrier.
        </p>
      </header>

      <ul className="space-y-2">
        {managedPlaces.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              onClick={() => openHub(place.slug)}
              className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-sky-600/40 hover:bg-sky-950/20 transition-colors flex items-center gap-4"
            >
              <CommunityAvatar
                avatar={null}
                logoEmoji={place.logo_emoji}
                accentColor={place.accent_color}
                size="md"
                alt={place.name}
              />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-slate-100 block truncate">{place.name}</span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  {place.member_count} membre{place.member_count > 1 ? 's' : ''}
                  {place.tagline ? ` · ${place.tagline}` : ''}
                </span>
              </span>
              <span className="text-slate-500 text-sm shrink-0" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
