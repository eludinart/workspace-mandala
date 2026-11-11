'use client'

import Link from 'next/link'
import type { PublicCommunityCard } from '@/api/communities'
import { RelierPlaceButton } from '@/components/place/RelierPlaceButton'
import { DEFAULT_AVATAR_EMOJI, isAvatarImageUrl } from '@/lib/user-avatar'

type Props = {
  place: PublicCommunityCard
  selected?: boolean
  onSelect?: () => void
  /** Affiche la proposition de lien lieu → lieu (carte / Découvrir connecté). */
  showRelier?: boolean
  /** CTA Rejoindre (accueil Explorer / hors appartenance). */
  showJoin?: boolean
  onJoin?: () => void
  joinBusy?: boolean
  /** Variante rail : cover un peu plus basse. */
  compact?: boolean
}

function normalizeWebsite(url: string): string {
  const t = url.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function composeAddress(place: PublicCommunityCard): string {
  const line2 = [place.postal_code, place.city].filter((v) => v && String(v).trim()).join(' ')
  const full = [place.address, line2, place.country]
    .map((v) => (v ? String(v).trim() : ''))
    .filter(Boolean)
    .join(', ')
  return full || (place.location ?? '')
}

function shortLocation(place: PublicCommunityCard): string {
  const city = place.city?.trim()
  if (city) {
    const country = place.country?.trim()
    if (country && !/^france$/i.test(country)) return `${city}, ${country}`
    return city
  }
  const loc = place.location?.trim()
  if (!loc) return ''
  return loc.length > 48 ? `${loc.slice(0, 46)}…` : loc
}

function directionsUrl(place: PublicCommunityCard): string | null {
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
  }
  const addr = composeAddress(place)
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`
}

function joinModeLabel(mode: PublicCommunityCard['join_mode']): string | null {
  if (mode === 'invite') return 'Sur invitation'
  if (mode === 'closed') return 'Fermé'
  if (mode === 'open') return 'Ouvert'
  return null
}

export function PlacePublicCard({
  place,
  selected,
  onSelect,
  showRelier,
  showJoin = false,
  onJoin,
  joinBusy = false,
  compact = false,
}: Props) {
  const website = place.website?.trim()
  const email = place.contact_email?.trim()
  const locationLine = shortLocation(place)
  const directions = directionsUrl(place)
  const accent = place.accent_color?.startsWith('#') ? place.accent_color : '#7c3aed'
  const hasPhoto = isAvatarImageUrl(place.avatar)
  const emoji = (place.logo_emoji && String(place.logo_emoji).trim()) || DEFAULT_AVATAR_EMOJI
  const modeLabel = joinModeLabel(place.join_mode)
  const members =
    typeof place.member_count === 'number' && place.member_count > 0 ? place.member_count : null
  const blurb = place.description?.trim() || ''

  return (
    <article
      id={`lieu-${place.slug}`}
      className={`m-place-card m-landing-card overflow-hidden transition-all scroll-mt-24 ${
        selected ? 'm-place-card--selected ring-1 ring-violet-500/45 border-violet-500/40' : ''
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left group"
        aria-label={place.name}
      >
        <div
          className={`m-place-card-cover relative ${compact ? 'm-place-card-cover--compact' : ''}`}
          style={
            hasPhoto
              ? undefined
              : {
                  background: `linear-gradient(145deg, ${accent}cc 0%, ${accent}55 42%, rgb(15 23 42) 100%)`,
                }
          }
        >
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.avatar!} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-5xl sm:text-6xl opacity-90" aria-hidden>
              {emoji}
            </span>
          )}
          <div className="m-place-card-cover-wash" aria-hidden />
          {(modeLabel || members != null) && (
            <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 z-[1]">
              {modeLabel && (
                <span className="m-place-card-chip">{modeLabel}</span>
              )}
              {members != null && (
                <span className="m-place-card-chip">
                  {members} membre{members > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pt-3.5 pb-1 space-y-1.5">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-100 leading-snug line-clamp-2">
            {place.name}
          </h3>
          {place.tagline?.trim() && (
            <p className="text-sm text-violet-300/85 line-clamp-2">{place.tagline.trim()}</p>
          )}
          {locationLine && (
            <p className="text-xs text-slate-500 line-clamp-1">📍 {locationLine}</p>
          )}
          {blurb && (
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 pt-0.5">{blurb}</p>
          )}
        </div>
      </button>

      <div className="px-4 pb-4 pt-3 flex flex-wrap gap-2 items-center">
        {showJoin && place.join_mode !== 'closed' && (
          <button
            type="button"
            disabled={joinBusy}
            onClick={(e) => {
              e.stopPropagation()
              onJoin?.()
            }}
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50"
          >
            {joinBusy
              ? '…'
              : place.join_mode === 'invite'
                ? "J'ai une invitation"
                : 'Rejoindre'}
          </button>
        )}
        {showJoin && place.join_mode === 'closed' && (
          <span className="inline-flex items-center text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-500">
            Adhésions fermées
          </span>
        )}
        {place.profile_public !== false ? (
          <Link
            href={`/lieux/${encodeURIComponent(place.slug)}`}
            className={`inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full font-medium ${
              showJoin
                ? 'border border-slate-600 text-slate-200 hover:bg-slate-800'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            Voir le profil →
          </Link>
        ) : (
          <span className="inline-flex items-center text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-500">
            Profil privé
          </span>
        )}
      </div>

      {showRelier && place.id > 0 && (
        <div className="px-4 pb-3 -mt-1">
          <RelierPlaceButton targetCommunityId={place.id} targetName={place.name} />
        </div>
      )}

      {(website || email || directions) && (
        <div className="px-4 pb-4 -mt-1 flex flex-wrap gap-2">
          {website && (
            <a
              href={normalizeWebsite(website)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
            >
              🌐 Site web
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
            >
              ✉️ Contacter
            </a>
          )}
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
            >
              🧭 Itinéraire
            </a>
          )}
        </div>
      )}
    </article>
  )
}
