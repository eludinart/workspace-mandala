'use client'

import Link from 'next/link'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { UserAvatar } from '@/components/UserAvatar'
import { formatEventDateRange, phaseBadgeClass, phaseLabel, eventTemporalBadge } from '@/lib/event-preview'
import { formatMandalaDate } from '@/lib/format-datetime'
import { placeAccentSurface } from '@/lib/place-accent'
import type { WallFeedItem } from '@/lib/wall-feed-types'

function KindBadge({ kind }: { kind: WallFeedItem['kind'] }) {
  const meta =
    kind === 'event'
      ? { label: 'Événement', icon: '📅', className: 'border-violet-500/40 bg-violet-950/50 text-violet-100' }
      : kind === 'announcement'
        ? { label: 'Annonce', icon: '📢', className: 'border-amber-500/40 bg-amber-950/40 text-amber-100' }
        : { label: 'Mur', icon: '💬', className: 'border-sky-500/40 bg-sky-950/40 text-sky-100' }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.className}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  )
}

function PlaceHeader({ place }: { place: WallFeedItem['place'] }) {
  const surface = placeAccentSurface(place.accent_color)
  return (
    <Link
      href={`/lieux/${encodeURIComponent(place.slug)}`}
      className="flex items-center gap-3 px-3 py-2.5 border-b transition-colors hover:brightness-110"
      style={{
        backgroundColor: surface.headerBg,
        borderColor: surface.cardBorder,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <CommunityAvatar
        avatar={place.avatar}
        logoEmoji={place.logo_emoji ?? '🏛️'}
        accentColor={place.accent_color ?? '#7c3aed'}
        size="sm"
        alt={place.name}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-slate-400/90 font-medium">Lieu</p>
        <p className="text-sm sm:text-base font-bold text-slate-50 truncate leading-tight">{place.name}</p>
      </div>
      <span className="text-slate-400 text-xs shrink-0 hidden sm:inline">Voir →</span>
    </Link>
  )
}

function CardShell({
  place,
  kind,
  children,
  onClick,
  hidePlaceHeader = false,
  muted = false,
}: {
  place: WallFeedItem['place']
  kind: WallFeedItem['kind']
  children: React.ReactNode
  onClick?: () => void
  hidePlaceHeader?: boolean
  muted?: boolean
}) {
  const surface = placeAccentSurface(place.accent_color)
  const article = (
    <article
      className={`rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:shadow-black/20 ${
        onClick ? 'cursor-pointer' : ''
      } ${muted ? 'opacity-80' : ''}`}
      style={{
        backgroundColor: muted ? placeAccentSurface(place.accent_color).cardBg : surface.cardBg,
        borderColor: muted ? 'rgba(100, 116, 139, 0.35)' : surface.cardBorder,
      }}
    >
      {!hidePlaceHeader && <PlaceHeader place={place} />}
      <div className="p-4 space-y-3">
        <KindBadge kind={kind} />
        {children}
      </div>
    </article>
  )
  if (onClick) {
    return (
      <button type="button" className="w-full text-left" onClick={onClick}>
        {article}
      </button>
    )
  }
  return article
}

export function WallFeedItemCard({
  item,
  onEventClick,
  compact = false,
}: {
  item: WallFeedItem
  onEventClick?: (eventId: number) => void
  compact?: boolean
}) {
  if (item.kind === 'event') {
    const temporal = eventTemporalBadge(item)
    const past = item.is_past
    return (
      <CardShell
        place={item.place}
        kind="event"
        hidePlaceHeader={compact}
        muted={past}
        onClick={onEventClick ? () => onEventClick(item.event_id) : undefined}
      >
        {item.cover_image && !compact && (
          <div className="relative -mx-1 rounded-xl overflow-hidden border border-white/5 h-36">
            <img
              src={item.cover_image}
              alt=""
              className={`w-full h-full object-cover ${past ? 'grayscale-[0.65] brightness-75' : ''}`}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind="event" />
          <span
            className={`inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${temporal.className}`}
          >
            {temporal.label}
          </span>
        </div>
        <h3 className={`text-lg font-semibold leading-snug ${past ? 'text-slate-400' : 'text-slate-50'}`}>
          {item.title}
        </h3>
        <p className="text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              past
                ? 'border-slate-600/40 bg-slate-900/50 text-slate-500'
                : 'border-white/10 bg-black/20 text-slate-100'
            }`}
          >
            {past && <span aria-hidden>🕐</span>}
            {formatEventDateRange(item.starts_at, item.ends_at)}
          </span>
        </p>
        {item.location && (
          <p className={`text-xs ${past ? 'text-slate-500' : 'text-slate-300/80'}`}>📍 {item.location}</p>
        )}
        {item.description && (
          <p
            className={`text-sm leading-relaxed line-clamp-3 ${
              past ? 'text-slate-500' : 'text-slate-300/90'
            }`}
          >
            {item.description}
          </p>
        )}
        {!past && (
          <span
            className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(item.phase)}`}
          >
            {phaseLabel(item.phase)}
          </span>
        )}
      </CardShell>
    )
  }

  if (item.kind === 'announcement') {
    return (
      <CardShell place={item.place} kind="announcement" hidePlaceHeader={compact}>
        <div className="flex items-start gap-2">
          <UserAvatar avatarEmoji={item.author_avatar_emoji} size="sm" alt={item.author_pseudo} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">
              {item.author_pseudo} · {formatMandalaDate(item.sort_at)}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-50 leading-snug">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{item.body}</p>
          </div>
        </div>
        {item.image_data && (
          <img
            src={item.image_data}
            alt=""
            className="w-full max-h-52 object-cover rounded-xl border border-white/10"
          />
        )}
      </CardShell>
    )
  }

  return (
    <CardShell place={item.place} kind="post" hidePlaceHeader={compact}>
      <div className="flex items-start gap-2">
        <UserAvatar avatarEmoji={item.author_avatar_emoji} size="sm" alt={item.author_pseudo} />
        <div className="min-w-0">
          <p className="text-xs text-slate-400">
            {item.author_pseudo} · {formatMandalaDate(item.sort_at)}
            <span className="ml-1 opacity-70">
              · {item.post_type === 'logistics' ? 'Logistique' : 'Inspiration'}
            </span>
          </p>
          <p className="mt-1.5 text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{item.content}</p>
        </div>
      </div>
    </CardShell>
  )
}
