'use client'

import { useCallback, useEffect, useState } from 'react'
import { eventsApi } from '@/api/events'
import { EVENT_PHASES } from '@/lib/event-constants'
import { formatMandalaDateTime } from '@/lib/format-datetime'
import { formatEventDateRange, phaseBadgeClass, phaseLabel } from '@/lib/event-preview'
import { ApiError } from '@/lib/api-client'

type EventDetailData = {
  event: {
    id: number
    title: string
    description: string | null
    location: string | null
    starts_at: string | null
    ends_at: string | null
    phase: string
    status: string
    cover_image?: string | null
  }
  staff: Array<{ pseudo: string; role: string }>
  tasks: Array<{ title: string; is_done: boolean }>
  media: Array<{ id: number; image_data: string; caption: string | null }>
  can_manage: boolean
}

export function EventDetailModal({
  eventId,
  onClose,
  onOpenFull,
}: {
  eventId: number
  onClose: () => void
  onOpenFull?: () => void
}) {
  const [data, setData] = useState<EventDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = (await eventsApi.get(eventId)) as EventDetailData
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger l’événement')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxSrc) setLightboxSrc(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, lightboxSrc])

  const event = data?.event
  const media = data?.media ?? []
  const doneTasks = data?.tasks.filter((t) => t.is_done).length ?? 0
  const totalTasks = data?.tasks.length ?? 0

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3 sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Détail de l'événement"
      >
        <div
          className="w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/50 shrink-0">
            <p className="text-sm font-semibold text-slate-200 truncate">
              {loading ? 'Chargement…' : event?.title ?? 'Événement'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
            >
              Fermer
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading && <p className="p-6 text-sm text-slate-400">Chargement du détail…</p>}
            {error && <p className="p-6 text-sm text-red-400">{error}</p>}
            {!loading && !error && event && (
              <>
                {event.cover_image && (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(event.cover_image!)}
                    className="block w-full"
                  >
                    <img
                      src={event.cover_image}
                      alt=""
                      className="w-full max-h-52 object-cover border-b border-slate-800"
                    />
                  </button>
                )}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="space-y-2">
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(event.phase)}`}
                    >
                      {phaseLabel(event.phase)}
                    </span>
                    <h2 className="text-xl font-bold text-slate-100">{event.title}</h2>
                    <p className="text-sm text-violet-300/90">
                      {formatEventDateRange(event.starts_at, event.ends_at)}
                    </p>
                    {event.location && <p className="text-sm text-slate-400">📍 {event.location}</p>}
                  </div>

                  {event.description && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Description</p>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  )}

                  {media.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-widest text-slate-500">
                        Photos ({media.length})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {media.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setLightboxSrc(m.image_data)}
                            className="relative rounded-lg overflow-hidden border border-slate-700 aspect-square group"
                          >
                            <img
                              src={m.image_data}
                              alt={m.caption ?? ''}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {m.caption && (
                              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-slate-200 px-1 py-0.5 truncate">
                                {m.caption}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.staff.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
                        Équipe ({data.staff.length})
                      </p>
                      <ul className="space-y-1.5">
                        {data.staff.slice(0, 6).map((s, i) => (
                          <li key={`${s.pseudo}-${i}`} className="text-sm text-slate-300 flex justify-between gap-2">
                            <span>{s.pseudo}</span>
                            <span className="text-xs text-slate-500">{s.role}</span>
                          </li>
                        ))}
                        {data.staff.length > 6 && (
                          <li className="text-xs text-slate-500">+ {data.staff.length - 6} autre(s)</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {totalTasks > 0 && (
                    <p className="text-xs text-slate-500">
                      Tâches : {doneTasks} / {totalTasks} terminée(s)
                    </p>
                  )}

                  <div className="text-xs text-slate-600">
                    Phase : {EVENT_PHASES.find((p) => p.id === event.phase)?.label ?? event.phase}
                    {event.starts_at && (
                      <>
                        {' · '}
                        Début {formatMandalaDateTime(event.starts_at)}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {!loading && !error && event && onOpenFull && (
            <div className="shrink-0 border-t border-slate-800 p-3 bg-slate-950/50">
              <button
                type="button"
                onClick={onOpenFull}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
              >
                Ouvrir la fiche complète
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-label="Agrandir la photo"
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Fermer
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
