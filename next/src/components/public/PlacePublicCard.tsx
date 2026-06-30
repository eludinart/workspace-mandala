'use client'

import type { PublicCommunityCard } from '@/api/communities'
import { CommunityAvatar } from '@/components/CommunityAvatar'

type Props = {
  place: PublicCommunityCard
  selected?: boolean
  onSelect?: () => void
}

function normalizeWebsite(url: string): string {
  const t = url.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function PlacePublicCard({ place, selected, onSelect }: Props) {
  const website = place.website?.trim()
  const email = place.contact_email?.trim()

  return (
    <article
      id={`lieu-${place.slug}`}
      className={`rounded-2xl border p-5 transition-all scroll-mt-24 ${
        selected
          ? 'border-violet-500/50 bg-violet-950/25 ring-1 ring-violet-500/30'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left flex gap-4 items-start"
      >
        <CommunityAvatar
          avatar={place.avatar}
          logoEmoji={place.logo_emoji}
          accentColor={place.accent_color}
          size="lg"
          alt={place.name}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-lg font-semibold text-slate-100">{place.name}</h3>
          {place.tagline && <p className="text-sm text-violet-300/80">{place.tagline}</p>}
          {place.location && <p className="text-xs text-slate-500">📍 {place.location}</p>}
        </div>
      </button>

      {place.description && (
        <p className="mt-4 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
          {place.description}
        </p>
      )}

      {(website || email) && (
        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      )}
    </article>
  )
}
