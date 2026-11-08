'use client'

import type { HomeEventPreview } from '@/lib/event-preview'
import {
  descriptionExcerpt,
  formatEventDateRange,
  phaseBadgeClass,
  phaseLabel,
} from '@/lib/event-preview'
import {
  featuredProgramMediaKind,
  resolveFeaturedProgramImage,
} from '@/lib/featured-program-media'
import { parseWallClockDateTime } from '@/lib/format-datetime'

function eventDateParts(startsAt: string | null): { day: string; month: string } | null {
  const d = parseWallClockDateTime(startsAt)
  if (!d) return null
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
  }
}

export function UpcomingEventCard({
  event,
  accent,
  onOpen,
  eyebrow,
  showPhase = false,
  showExcerpt = false,
}: {
  event: HomeEventPreview
  accent: string
  onOpen: () => void
  eyebrow?: string | null
  showPhase?: boolean
  showExcerpt?: boolean
}) {
  const image = resolveFeaturedProgramImage(event)
  const mediaKind = featuredProgramMediaKind(image)
  const parts = eventDateParts(event.starts_at)
  const hostAccent = event.host_accent_color?.trim() || accent
  const excerpt = showExcerpt ? descriptionExcerpt(event.description, 140) : null
  const topLabel = eyebrow || event.host_name || null

  return (
    <article
      className="m-upcoming-card"
      style={{ borderColor: `${hostAccent}44` }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="m-upcoming-card-media relative overflow-hidden rounded-[1.15rem] border border-slate-800 bg-slate-950 min-h-[10.5rem] sm:min-h-[11.5rem] w-full text-left hover:border-violet-500/40 transition-colors"
        aria-label={`Ouvrir ${event.title}`}
      >
        {mediaKind === 'image' && image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(145deg, ${hostAccent}55, rgb(15 23 42), rgb(2 6 23))`,
            }}
          />
        )}
        {mediaKind === 'image' && (
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent"
            aria-hidden
          />
        )}
        {showPhase && (
          <span
            className={`absolute top-3 left-3 z-[2] text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm ${phaseBadgeClass(event.phase)}`}
          >
            {phaseLabel(event.phase)}
          </span>
        )}
        <div className="relative z-[1] min-h-[10.5rem] sm:min-h-[11.5rem] h-full flex items-center justify-center p-5">
          {parts ? (
            <span className="m-home-date shadow-lg shadow-black/30">
              <span className="m-home-date-day">{parts.day}</span>
              <span className="m-home-date-month">{parts.month}</span>
            </span>
          ) : (
            <span className="m-home-date shadow-lg shadow-black/30">
              <span className="m-home-date-month">Date</span>
            </span>
          )}
        </div>
      </button>

      <div className="m-upcoming-card-body space-y-3 sm:space-y-3.5 min-w-0 py-1">
        {topLabel && (
          <p
            className="m-landing-eyebrow text-left"
            style={event.host_name && !eyebrow ? { color: hostAccent } : undefined}
          >
            {topLabel}
          </p>
        )}
        <h3 className="text-2xl sm:text-[1.65rem] leading-snug text-slate-100">
          {event.title}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          {formatEventDateRange(event.starts_at, event.ends_at)}
          {event.location ? ` · ${event.location}` : ''}
        </p>
        {excerpt && (
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{excerpt}</p>
        )}
        <button type="button" onClick={onOpen} className="m-landing-btn">
          En savoir plus
        </button>
      </div>
    </article>
  )
}
