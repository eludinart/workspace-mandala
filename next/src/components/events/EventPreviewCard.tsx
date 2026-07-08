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
  const coverClass =
    variant === 'hero'
      ? 'relative w-full max-h-48 bg-slate-950 overflow-hidden'
      : 'relative w-full aspect-[2/1] bg-slate-950'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden hover:border-violet-500/40 transition-colors group"
    >
      {showCover ? (
        <div className={coverClass}>
          <img
            src={event.cover_image!}
            alt=""
            className={`w-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ${
              variant === 'hero' ? 'h-48' : 'h-full'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <span
            className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(event.phase)}`}
          >
            {phaseLabel(event.phase)}
          </span>
          {(event.media_count ?? 0) > 0 && (
            <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-slate-200 border border-slate-600/50">
              📷 {event.media_count}
            </span>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 flex items-center justify-between gap-2">
          <span
            className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(event.phase)}`}
          >
            {phaseLabel(event.phase)}
          </span>
          {(event.media_count ?? 0) > 0 && (
            <span className="text-[10px] text-slate-500">📷 {event.media_count} photo(s)</span>
          )}
        </div>
      )}

      <div className={`p-4 space-y-2 ${showCover ? '-mt-2 relative' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`font-semibold text-slate-100 leading-snug ${
              variant === 'hero' ? 'text-xl' : ''
            }`}
          >
            {event.title}
          </h3>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-950/40 px-2.5 py-1 font-semibold text-slate-100 ${
              variant === 'hero' ? 'text-sm' : 'text-xs'
            }`}
          >
            <span aria-hidden>📅</span>
            {formatEventDateRange(event.starts_at, event.ends_at)}
          </span>
        </div>
        {event.location && (
          <p className={variant === 'hero' ? 'text-sm text-slate-400' : 'text-xs text-slate-500'}>
            📍 {event.location}
          </p>
        )}
        {excerpt && (
          <p
            className={`text-slate-400 leading-relaxed line-clamp-2 ${
              variant === 'hero' ? 'text-base' : 'text-sm'
            }`}
          >
            {excerpt}
          </p>
        )}
        <p className="text-sm text-violet-400 group-hover:text-violet-300 font-medium">
          Voir le détail →
        </p>
      </div>
    </button>
  )
}
