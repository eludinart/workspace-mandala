'use client'

import { useEffect, useState } from 'react'
import { enumerateEventDays } from '@/lib/event-dates'
import {
  type MonthEvent,
  type MonthDay,
  type PresentUser,
  dayLabelFr,
  dayTone,
  displayLabel,
  formatEventTime,
  phaseColor,
  phaseSoftBg,
  selectionSpan,
} from '@/components/calendar/calendar-utils'

const DEFAULT_MAX = 20

export type DayDetailData = {
  detail: {
    day: string
    is_disabled: boolean
    disabled_reason?: string | null
    max_participants?: number
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
  selectedDays,
  selectionBusy,
  onToggleSelfPresence,
  onApplySelection,
  onCreateSelectionEvent,
  onClearSelection,
  onRemoveUser,
  onSetEventSpanPresence,
  dayOpen,
  dayPresent,
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
  selectedDays: string[]
  selectionBusy: boolean
  onToggleSelfPresence: (present: boolean) => void
  onApplySelection: (patch: {
    is_disabled?: boolean
    reason?: string
    max_participants?: number
  }) => void | Promise<void>
  onCreateSelectionEvent: (title: string, openDays: boolean) => void | Promise<void>
  onClearSelection: () => void
  onRemoveUser: (userId: number) => void
  onSetEventSpanPresence?: (days: string[], present: boolean) => void
  dayOpen?: (day: string) => boolean | null
  dayPresent?: (day: string) => boolean | null
  variant: 'sheet' | 'sidebar'
}) {
  const maxParticipants =
    dayDetail?.detail.max_participants ??
    selectedDayInfo?.max_participants ??
    DEFAULT_MAX
  const presentCount =
    dayDetail?.detail.present_users.length ?? selectedDayInfo?.present_count ?? 0
  const isFull = presentCount >= maxParticipants
  const [maxDraft, setMaxDraft] = useState(String(maxParticipants))
  const [closeReason, setCloseReason] = useState('')
  const [eventOpen, setEventOpen] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [openDaysToo, setOpenDaysToo] = useState(true)
  const many = selectedDays.length > 1
  const span = selectionSpan(selectedDays)

  useEffect(() => {
    setMaxDraft(String(maxParticipants))
  }, [selectedDay, maxParticipants])

  const tone = dayTone(
    dayDetail
      ? {
          is_disabled: dayDetail.detail.is_disabled,
          present_count: dayDetail.detail.present_users.length,
          max_participants: maxParticipants,
        }
      : selectedDayInfo
  )
  const closedReason = dayDetail?.detail.disabled_reason ?? selectedDayInfo?.disabled_reason ?? null
  const shellClass =
    variant === 'sidebar'
      ? `rounded-2xl border-2 overflow-hidden flex flex-col h-full min-h-[320px] ${
          many ? 'border-violet-500/60 bg-slate-900' : toneShell(tone)
        }`
      : `m-sheet-max m-above-os-chrome w-full max-w-lg rounded-2xl border-2 overflow-hidden flex flex-col shadow-2xl bg-slate-900 ${
          many ? 'border-violet-500/60' : toneShell(tone)
        }`

  const saveMax = () => {
    const n = parseInt(maxDraft, 10)
    if (!Number.isFinite(n) || n < 1) return
    void onApplySelection({ max_participants: n })
  }

  return (
    <div className={shellClass}>
      <div
        className={`flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0 ${
          many ? 'border-violet-500/40 bg-violet-950/40' : toneHeader(tone)
        }`}
      >
        <div className="min-w-0">
          <p
            className={`text-[10px] uppercase tracking-widest font-semibold ${
              many ? 'text-violet-200' : toneLabelClass(tone)
            }`}
          >
            {many
              ? 'Jours choisis'
              : tone === 'closed'
                ? 'Jour fermé'
                : tone === 'full'
                  ? 'Jour complet'
                  : 'Jour ouvert'}
          </p>
          <p className="font-semibold capitalize text-sm sm:text-base leading-tight text-slate-50">
            {many
              ? `${selectedDays.length} jours`
              : dayLabelFr(selectedDay)}
          </p>
          {many && span && (
            <p className="text-xs text-violet-200/80 mt-0.5">
              {shortRange(span.start, span.end)}
              {span.gaps ? ' · des jours manquent entre les deux' : ''}
            </p>
          )}
          {!many && tone === 'closed' && closedReason && (
            <p className="text-xs text-red-200/90 mt-0.5 truncate">{closedReason}</p>
          )}
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

        {!detailLoading && !many && showPresence && selectedDayInfo && (
          <div
            className={`m-user-form rounded-xl border p-4 flex items-center justify-between gap-3 ${
              selectedDayInfo.i_am_present
                ? 'border-emerald-500/40 bg-emerald-950/25'
                : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">Mon inscription</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDayInfo.is_disabled
                  ? closedReason
                    ? `Cette journée est fermée. ${closedReason}`
                    : 'Cette journée est fermée.'
                  : selectedDayInfo.i_am_present
                    ? 'Vous serez présent(e) ce jour-là.'
                    : isFull
                      ? `Complet (${presentCount}/${maxParticipants}).`
                      : 'Inscrivez-vous pour indiquer votre présence.'}
              </p>
            </div>
            <button
              type="button"
              disabled={
                selectedDayInfo.is_disabled ||
                presenceBusy ||
                (!selectedDayInfo.i_am_present && isFull)
              }
              onClick={() => onToggleSelfPresence(!selectedDayInfo.i_am_present)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
                selectedDayInfo.i_am_present
                  ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-600/30'
                  : 'bg-violet-600 text-white hover:bg-violet-500'
              }`}
            >
              {selectedDayInfo.i_am_present ? 'Annuler' : 'Je viens'}
            </button>
          </div>
        )}

        {canManage && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-amber-100">Gestion du lieu</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {many
                    ? 'Les boutons agissent sur tous les jours choisis.'
                    : 'Les mêmes boutons servent pour un jour ou pour plusieurs.'}
                </p>
              </div>
              {many && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-xs text-slate-400 hover:text-slate-200 shrink-0"
                >
                  Effacer
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selectionBusy}
                onClick={() => void onApplySelection({ is_disabled: false })}
                className="px-3 py-1.5 text-sm rounded-lg border border-emerald-600/50 text-emerald-100 hover:bg-emerald-900/30 disabled:opacity-40"
              >
                Ouvrir
              </button>
              <button
                type="button"
                disabled={selectionBusy}
                onClick={() => void onApplySelection({ is_disabled: true, reason: closeReason })}
                className="px-3 py-1.5 text-sm rounded-lg border border-red-600/50 text-red-100 hover:bg-red-900/30 disabled:opacity-40"
              >
                Fermer
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-amber-200/70">
                Motif de fermeture
              </span>
              <input
                type="text"
                value={closeReason}
                maxLength={255}
                placeholder="Retraite, lieu vide…"
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full rounded-lg border border-amber-800/50 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 min-w-[8rem]">
                <span className="text-[11px] uppercase tracking-wide text-amber-200/70">
                  Places max
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxDraft}
                  onChange={(e) => setMaxDraft(e.target.value)}
                  className="w-24 rounded-lg border border-amber-800/50 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>
              <button
                type="button"
                disabled={selectionBusy}
                onClick={saveMax}
                className="px-3 py-1.5 text-sm rounded-lg border border-amber-600/50 text-amber-100 hover:bg-amber-900/30 disabled:opacity-40"
              >
                Enregistrer
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEventOpen((v) => !v)}
              className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500"
            >
              Créer un événement
            </button>
            {eventOpen && span && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!eventTitle.trim()) return
                  void onCreateSelectionEvent(eventTitle.trim(), openDaysToo)
                  setEventTitle('')
                  setEventOpen(false)
                }}
              >
                <p className="text-xs text-slate-400">
                  Du {shortRange(span.start, span.end)}
                  {span.gaps ? ', y compris les jours non cochés' : ''}. Seuls les jours choisis sont ouverts.
                </p>
                <input
                  type="text"
                  value={eventTitle}
                  required
                  placeholder="Titre"
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={openDaysToo}
                    onChange={(e) => setOpenDaysToo(e.target.checked)}
                  />
                  Ouvrir ces jours
                </label>
                <button
                  type="submit"
                  disabled={selectionBusy || !eventTitle.trim()}
                  className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white disabled:opacity-40"
                >
                  {selectionBusy ? 'Création…' : 'Créer'}
                </button>
              </form>
            )}
          </div>
        )}

        {!detailLoading && !many && dayDetail && showEvents && (
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
                        {onSetEventSpanPresence && (
                          <EventSpanButton
                            event={ev}
                            dayOpen={dayOpen}
                            dayPresent={dayPresent}
                            busy={presenceBusy}
                            onSet={onSetEventSpanPresence}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!detailLoading && !many && dayDetail && showPresence && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inscrits ({presentCount}/{maxParticipants})
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

function EventSpanButton({
  event,
  dayOpen,
  dayPresent,
  busy,
  onSet,
}: {
  event: MonthEvent
  dayOpen?: (day: string) => boolean | null
  dayPresent?: (day: string) => boolean | null
  busy: boolean
  onSet: (days: string[], present: boolean) => void
}) {
  const span = enumerateEventDays(event.starts_at, event.ends_at)
  if (span.length < 2 || !dayOpen || !dayPresent) return null
  const knownOpen = span.filter((day) => dayOpen(day) === true)
  const unknown = span.some((day) => dayOpen(day) == null)
  if (!unknown && knownOpen.length < 2) return null
  const targets = knownOpen.length > 0 ? knownOpen : span
  const allPresent = !unknown && targets.every((day) => dayPresent(day) === true)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onSet(span, !allPresent)}
      className="mt-2 text-xs px-2.5 py-1 rounded-lg border border-violet-500/40 text-violet-100 hover:bg-violet-900/30 disabled:opacity-40"
    >
      {allPresent ? 'Annuler sur tous les jours' : 'Je viens sur tous les jours ouverts'}
    </button>
  )
}

function shortRange(start: string, end: string): string {
  const fmt = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

function toneShell(tone: 'closed' | 'full' | 'open'): string {
  if (tone === 'closed') return 'border-red-500/70 bg-red-950/20'
  if (tone === 'full') return 'border-amber-500/70 bg-amber-950/20'
  return 'border-emerald-600/60 bg-emerald-950/15'
}

function toneHeader(tone: 'closed' | 'full' | 'open'): string {
  if (tone === 'closed') return 'border-red-500/40 bg-red-950/50'
  if (tone === 'full') return 'border-amber-500/40 bg-amber-950/40'
  return 'border-emerald-500/30 bg-emerald-950/40'
}

function toneLabelClass(tone: 'closed' | 'full' | 'open'): string {
  if (tone === 'closed') return 'text-red-200'
  if (tone === 'full') return 'text-amber-200'
  return 'text-emerald-200'
}
