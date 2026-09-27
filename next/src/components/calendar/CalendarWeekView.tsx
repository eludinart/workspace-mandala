'use client'

import type { DayEvent, MonthDay } from '@/components/calendar/calendar-utils'
import {
  displayLabel,
  formatEventShortTime,
  phaseSoftBg,
  shortWeekdayFr,
} from '@/components/calendar/calendar-utils'

export function CalendarWeekView({
  weekDays,
  daysMap,
  eventsByDay,
  selectedDay,
  today,
  showEvents,
  showPresence,
  viewerId,
  onSelectDay,
}: {
  weekDays: string[]
  daysMap: Map<string, MonthDay>
  eventsByDay: Map<string, DayEvent[]>
  selectedDay: string | null
  today: Date
  showEvents: boolean
  showPresence: boolean
  viewerId: number | null
  onSelectDay: (day: string) => void
}) {
  return (
    <div className="space-y-3 md:space-y-0">
      {/* Mobile : liste verticale détaillée */}
      <div className="md:hidden space-y-3">
        {weekDays.map((day) => (
          <WeekDayCard
            key={day}
            day={day}
            info={daysMap.get(day)}
            events={eventsByDay.get(day) ?? []}
            selected={selectedDay === day}
            isToday={isTodayDay(day, today)}
            showEvents={showEvents}
            showPresence={showPresence}
            viewerId={viewerId}
            onSelect={() => onSelectDay(day)}
          />
        ))}
      </div>

      {/* Tablette / desktop : 7 colonnes */}
      <div className="hidden md:grid md:grid-cols-7 gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 overflow-hidden p-2 shadow-lg shadow-black/20">
        {weekDays.map((day) => (
          <WeekDayColumn
            key={day}
            day={day}
            info={daysMap.get(day)}
            events={eventsByDay.get(day) ?? []}
            selected={selectedDay === day}
            isToday={isTodayDay(day, today)}
            showEvents={showEvents}
            showPresence={showPresence}
            viewerId={viewerId}
            onSelect={() => onSelectDay(day)}
          />
        ))}
      </div>
    </div>
  )
}

function isTodayDay(day: string, today: Date): boolean {
  const d = new Date(day + 'T12:00:00')
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

function WeekDayCard({
  day,
  info,
  events,
  selected,
  isToday,
  showEvents,
  showPresence,
  viewerId,
  onSelect,
}: {
  day: string
  info?: MonthDay
  events: DayEvent[]
  selected: boolean
  isToday: boolean
  showEvents: boolean
  showPresence: boolean
  viewerId: number | null
  onSelect: () => void
}) {
  const d = new Date(day + 'T12:00:00')
  const disabled = info?.is_disabled ?? false
  const presentUsers = info?.present_users ?? []

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${
        disabled
          ? selected
            ? 'border-red-400 bg-red-950/55 ring-2 ring-violet-300/70'
            : 'border-red-500 bg-red-950/45 hover:bg-red-950/60'
          : selected
            ? 'border-emerald-400 bg-emerald-950/45 ring-2 ring-violet-300/70'
            : 'border-emerald-600/80 bg-emerald-950/35 hover:bg-emerald-950/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl text-white ${
              isToday
                ? 'bg-violet-600 ring-2 ring-offset-2 ring-offset-transparent ' +
                  (disabled ? 'ring-red-300' : 'ring-emerald-300')
                : disabled
                  ? 'bg-red-600'
                  : 'bg-emerald-600'
            }`}
          >
            <span className="text-[10px] uppercase font-medium opacity-80">{shortWeekdayFr(day)}</span>
            <span className="text-lg font-bold leading-none">{d.getDate()}</span>
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100 capitalize">
              {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p
              className={`text-xs font-semibold ${disabled ? 'text-red-200' : 'text-emerald-200'}`}
            >
              {disabled ? 'Journée fermée' : 'Journée ouverte'}
            </p>
            {info?.i_am_present && (
              <p className="text-xs text-emerald-400 font-medium">Vous êtes inscrit(e)</p>
            )}
          </div>
        </div>
        {showPresence && (info?.present_count ?? 0) > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400 tabular-nums">
            {info?.present_count}/{info?.max_participants ?? 20}
          </span>
        )}
      </div>

      {showEvents && events.length > 0 && (
        <ul className="space-y-2 mb-3">
          {events.map((ev) => (
            <li
              key={`${ev.id}-${day}`}
              className={`rounded-lg border px-3 py-2 text-sm ${phaseSoftBg(ev.phase)}`}
            >
              <p className="font-medium">{ev.title}</p>
              {ev.starts_at && (
                <p className="text-xs opacity-75 mt-0.5">{formatEventShortTime(ev.starts_at)}</p>
              )}
              {ev.location && <p className="text-xs opacity-70 mt-0.5">📍 {ev.location}</p>}
            </li>
          ))}
        </ul>
      )}

      {showEvents && events.length === 0 && !disabled && (
        <p className="text-xs text-slate-500 italic mb-2">Aucun événement</p>
      )}

      {showPresence && presentUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presentUsers.slice(0, 8).map((u) => (
            <span
              key={u.user_id}
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                viewerId === u.user_id
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {displayLabel(u, viewerId)}
            </span>
          ))}
          {presentUsers.length > 8 && (
            <span className="text-[11px] text-slate-500">+{presentUsers.length - 8}</span>
          )}
        </div>
      )}
    </button>
  )
}

function WeekDayColumn({
  day,
  info,
  events,
  selected,
  isToday,
  showEvents,
  showPresence,
  viewerId,
  onSelect,
}: {
  day: string
  info?: MonthDay
  events: DayEvent[]
  selected: boolean
  isToday: boolean
  showEvents: boolean
  showPresence: boolean
  viewerId: number | null
  onSelect: () => void
}) {
  const d = new Date(day + 'T12:00:00')
  const disabled = info?.is_disabled ?? false
  const presentUsers = info?.present_users ?? []

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col min-h-[280px] rounded-xl border-2 p-2 text-left transition-colors ${
        disabled
          ? selected
            ? 'border-red-400 bg-red-950/50 ring-2 ring-violet-300/70'
            : 'border-red-500/80 bg-red-950/40 hover:bg-red-950/55'
          : selected
            ? 'border-emerald-400 bg-emerald-950/40 ring-2 ring-violet-300/70'
            : 'border-emerald-600/70 bg-emerald-950/30 hover:bg-emerald-950/45'
      }`}
    >
      <div
        className={`shrink-0 pb-2 border-b mb-2 ${
          disabled ? 'border-red-500/40' : 'border-emerald-500/30'
        }`}
      >
        <p
          className={`text-[10px] uppercase tracking-wide font-semibold ${
            disabled ? 'text-red-200' : 'text-emerald-200'
          }`}
        >
          {shortWeekdayFr(day)} · {disabled ? 'Fermé' : 'Ouvert'}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span
            className={`text-lg font-bold text-white flex items-center justify-center w-8 h-8 rounded-full ${
              isToday
                ? `bg-violet-600 ring-2 ${disabled ? 'ring-red-300' : 'ring-emerald-300'}`
                : disabled
                  ? 'bg-red-600'
                  : 'bg-emerald-600'
            }`}
          >
            {d.getDate()}
          </span>
          {showPresence && (info?.present_count ?? 0) > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                info?.i_am_present
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {info?.present_count}/{info?.max_participants ?? 20}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto">
        {showEvents &&
          events.map((ev) => (
            <div
              key={`${ev.id}-${day}`}
              className={`text-[11px] leading-snug px-2 py-1.5 rounded-lg border ${phaseSoftBg(ev.phase)}`}
              title={ev.title}
            >
              <p className="font-medium line-clamp-2">{ev.title}</p>
              {ev.starts_at && (
                <p className="opacity-70 mt-0.5">{formatEventShortTime(ev.starts_at)}</p>
              )}
            </div>
          ))}

        {showPresence &&
          presentUsers.slice(0, 5).map((u) => (
            <p
              key={u.user_id}
              className={`text-[10px] truncate px-1.5 py-0.5 rounded ${
                viewerId === u.user_id ? 'text-violet-300 bg-violet-900/30' : 'text-slate-500'
              }`}
            >
              {displayLabel(u, viewerId)}
            </p>
          ))}
        {showPresence && presentUsers.length > 5 && (
          <p className="text-[9px] text-slate-600 pl-1">+{presentUsers.length - 5}</p>
        )}
      </div>
    </button>
  )
}
