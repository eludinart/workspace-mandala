'use client'

import {
  type MonthEvent,
  type MonthDay,
  type PresentUser,
  dayLabelFr,
  displayLabel,
  formatEventTime,
  phaseColor,
  phaseSoftBg,
} from '@/components/calendar/calendar-utils'

export type DayDetailData = {
  detail: {
    day: string
    is_disabled: boolean
    present_users: PresentUser[]
    events: MonthEvent[]
  }
  settings: { show_presence: boolean; show_events: boolean }
}

export function CalendarDayPanel({
  selectedDay,
  dayDetail,
  selectedDayInfo,
  detailLoading,
  showEvents,
  showPresence,
  canManage,
  viewerId,
  presenceBusy,
  onClose,
  onToggleSelfPresence,
  onToggleDayDisabled,
  onRemoveUser,
  variant,
}: {
  selectedDay: string
  dayDetail: DayDetailData | null
  selectedDayInfo?: MonthDay
  detailLoading: boolean
  showEvents: boolean
  showPresence: boolean
  canManage: boolean
  viewerId: number | null
  presenceBusy: boolean
  onClose?: () => void
  onToggleSelfPresence: (present: boolean) => void
  onToggleDayDisabled: (disabled: boolean) => void
  onRemoveUser: (userId: number) => void
  variant: 'sheet' | 'sidebar'
}) {
  const shellClass =
    variant === 'sidebar'
      ? 'rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col h-full min-h-[320px]'
      : 'w-full max-w-lg max-h-[90vh] rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden flex flex-col shadow-2xl'

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/50 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Journée</p>
          <p className="font-semibold capitalize text-sm sm:text-base leading-tight">
            {dayLabelFr(selectedDay)}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
          >
            Fermer
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
        {detailLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 rounded-xl bg-slate-800/60" />
            <div className="h-24 rounded-xl bg-slate-800/40" />
          </div>
        )}

        {!detailLoading && showPresence && selectedDayInfo && (
          <div
            className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
              selectedDayInfo.i_am_present
                ? 'border-emerald-500/40 bg-emerald-950/25'
                : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">Mon inscription</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDayInfo.is_disabled
                  ? 'Cette journée est fermée.'
                  : selectedDayInfo.i_am_present
                    ? 'Vous serez présent(e) ce jour-là.'
                    : 'Inscrivez-vous pour indiquer votre présence.'}
              </p>
            </div>
            <button
              type="button"
              disabled={selectedDayInfo.is_disabled || presenceBusy}
              onClick={() => onToggleSelfPresence(!selectedDayInfo.i_am_present)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
                selectedDayInfo.i_am_present
                  ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-600/30'
                  : 'bg-violet-600 text-white hover:bg-violet-500'
              }`}
            >
              {selectedDayInfo.i_am_present ? 'Annuler' : "Je viens"}
            </button>
          </div>
        )}

        {!detailLoading && dayDetail && canManage && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-100">Gestion du lieu</p>
              <p className="text-xs text-slate-400 mt-0.5">Réservé aux gestionnaires et administrateurs.</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleDayDisabled(!dayDetail.detail.is_disabled)}
              className={`px-3 py-1.5 text-sm rounded-lg border font-medium ${
                dayDetail.detail.is_disabled
                  ? 'border-emerald-600/50 text-emerald-200 hover:bg-emerald-900/30'
                  : 'border-amber-600/50 text-amber-200 hover:bg-amber-900/30'
              }`}
            >
              {dayDetail.detail.is_disabled ? 'Réouvrir' : 'Fermer le jour'}
            </button>
          </div>
        )}

        {!detailLoading && dayDetail && showEvents && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Événements ({dayDetail.detail.events.length})
            </h2>
            {dayDetail.detail.events.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">Rien de prévu ce jour-là.</p>
            ) : (
              <ul className="space-y-2">
                {dayDetail.detail.events.map((ev) => (
                  <li
                    key={ev.id}
                    className={`rounded-xl border p-3 ${phaseSoftBg(ev.phase)}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-1 self-stretch rounded-full shrink-0 ${phaseColor(ev.phase)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-100">{ev.title}</p>
                        <p className="text-xs opacity-80 mt-1">{formatEventTime(ev)}</p>
                        {ev.location && (
                          <p className="text-xs opacity-70 mt-1">📍 {ev.location}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!detailLoading && dayDetail && showPresence && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inscrits ({dayDetail.detail.present_users.length})
              </h2>
            </div>
            {dayDetail.detail.present_users.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">Personne inscrit pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-1.5">
                {dayDetail.detail.present_users.map((u) => {
                  const isMe = viewerId != null && u.user_id === viewerId
                  return (
                    <li
                      key={u.user_id}
                      className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 ${
                        isMe
                          ? 'border-violet-500/40 bg-violet-950/30'
                          : 'border-slate-800 bg-slate-950/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {displayLabel(u, viewerId)}
                          {isMe && (
                            <span className="ml-1.5 text-[10px] uppercase text-violet-300 font-normal">
                              vous
                            </span>
                          )}
                        </p>
                      </div>
                      {canManage && !isMe && (
                        <button
                          type="button"
                          disabled={presenceBusy}
                          onClick={() => onRemoveUser(u.user_id)}
                          className="shrink-0 text-[11px] px-2 py-1 rounded-lg border border-red-800/40 text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
