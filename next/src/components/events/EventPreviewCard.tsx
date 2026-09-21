'use client'

import {
  type HomeEventPreview,
  descriptionExcerpt,
  formatEventDateRange,
  phaseBadgeClass,
  phaseLabel,
} from '@/lib/event-preview'

export function EventPreviewCard({
  event,
  onClick,
  variant = 'default',
}: {
  event: HomeEventPreview
  onClick: () => void
  variant?: 'default' | 'hero' | 'compact'
}) {
  const excerpt = descriptionExcerpt(event.description, variant === 'compact' ? 80 : 140)

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-violet-500/40 transition-colors group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base text-slate-100 leading-snug">{event.title}</h3>
            <p className="mt-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-950/40 px-2.5 py-1 text-sm font-semibold text-slate-100">
                <span aria-hidden>📅</span>
                {formatEventDateRange(event.starts_at, event.ends_at)}
              </span>
            </p>
            {event.location && <p className="text-sm text-slate-500 mt-0.5">📍 {event.location}</p>}
          </div>
          <span
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(event.phase)}`}
          >
            {phaseLabel(event.phase)}
          </span>
        </div>
      </button>
    )
  }

  const showCover = !!event.cover_image

  if (variant === 'hero') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden hover:border-violet-500/40 transition-colors group"
      >
        {showCover && (
          <div className="relative w-full h-36 bg-slate-950 overflow-hidden">
            <img
              src={event.cover_image!}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <span
              className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(event.phase)}`}
            >
              {phaseLabel(event.phase)}
            </span>
          </div>
        )}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-xl text-slate-100 leading-snug">{event.title}</h3>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-950/40 px-2.5 py-1 text-sm font-semibold text-slate-100">
            <span aria-hidden>📅</span>
            {formatEventDateRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && <p className="text-sm text-slate-400">📍 {event.location}</p>}
          {excerpt && <p className="text-slate-400 leading-relaxed line-clamp-2 text-base">{excerpt}</p>}
          <p className="text-sm text-violet-400 group-hover:text-violet-300 font-medium">
            Voir le détail →
          </p>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden hover:border-violet-500/40 transition-colors group"
    >
      <div className="flex items-stretch gap-0 sm:gap-0">
        {showCover && (
          <div className="relative shrink-0 w-28 sm:w-36 h-24 sm:h-28 bg-slate-950 overflow-hidden">
            <img
              src={event.cover_image!}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
            {(event.media_count ?? 0) > 0 && (
              <span className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/55 text-slate-200">
                📷 {event.media_count}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 p-3 sm:p-4 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-100 leading-snug">{event.title}</h3>
            <span
              className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(event.phase)}`}
            >
              {phaseLabel(event.phase)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-950/40 px-2.5 py-1 text-xs font-semibold text-slate-100">
            <span aria-hidden>📅</span>
            {formatEventDateRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && <p className="text-xs text-slate-500">📍 {event.location}</p>}
          {excerpt && (
            <p className="text-slate-400 leading-relaxed line-clamp-2 text-sm">{excerpt}</p>
          )}
          <p className="text-sm text-violet-400 group-hover:text-violet-300 font-medium">
            Voir le détail →
          </p>
        </div>
      </div>
    </button>
  )
}
