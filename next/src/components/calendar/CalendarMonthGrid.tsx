'use client'

import { useMemo } from 'react'
import type { MonthEvent } from '@/components/calendar/calendar-utils'
import { phaseColor, weekdayHeadersFr } from '@/components/calendar/calendar-utils'
import {
  countHiddenEventBars,
  layoutEventBarsForWeek,
  layoutPresenceBarsForWeek,
  maxPresenceCountInWeek,
  maxVisibleEventRows,
  splitGridIntoWeeks,
  totalEventRowsInWeek,
  type MonthGridCell,
} from '@/components/calendar/calendar-month-layout'

const MAX_PRESENCE_ROWS_MOBILE = 2
const MAX_PRESENCE_ROWS_DESKTOP = 3

function weekMetrics(isMobile: boolean) {
  return {
    headerH: isMobile ? 42 : 48,
    barH: isMobile ? 20 : 22,
    gap: 4,
    padBottom: isMobile ? 6 : 8,
    overflowH: 18,
  }
}

export function CalendarMonthGrid({
  grid,
  events,
  selectedDay,
  today,
  showEvents,
  showPresence,
  viewerId = null,
  onSelectDay,
}: {
  grid: MonthGridCell[]
  events: MonthEvent[]
  selectedDay: string | null
  today: Date
  showEvents: boolean
  showPresence: boolean
  viewerId?: number | null
  onSelectDay: (day: string) => void
}) {
  const weeks = useMemo(() => splitGridIntoWeeks(grid), [grid])

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 overflow-hidden shadow-lg shadow-black/20">
      <div className="grid grid-cols-7 border-b border-slate-800/80 bg-slate-950/80">
        {weekdayHeadersFr(false).map((w, i) => (
          <div
            key={w}
            className={`py-2.5 text-center text-[10px] sm:text-[11px] font-medium uppercase tracking-wide ${
              i === 6 ? 'text-rose-400/80' : 'text-slate-500'
            }`}
          >
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{weekdayHeadersFr(true)[i]}</span>
          </div>
        ))}
      </div>

      <div className="divide-y divide-slate-800/60">
        {weeks.map((week) => (
          <MonthWeekRowBlock
            key={week.days[0]?.day ?? 'w'}
            week={week}
            events={showEvents ? events : []}
            selectedDay={selectedDay}
            today={today}
            showPresence={showPresence}
            viewerId={viewerId}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    </div>
  )
}

function MonthWeekRowBlock({
  week,
  events,
  selectedDay,
  today,
  showPresence,
  viewerId,
  onSelectDay,
}: {
  week: { days: MonthGridCell[] }
  events: MonthEvent[]
  selectedDay: string | null
  today: Date
  showPresence: boolean
  viewerId: number | null
  onSelectDay: (day: string) => void
}) {
  const weekDays = week.days.map((d) => d.day)
  const segments = useMemo(() => layoutEventBarsForWeek(weekDays, events), [weekDays, events])
  const eventRowCount = totalEventRowsInWeek(segments)

  return (
    <>
      <div className="sm:hidden">
        <WeekRowInner
          week={week}
          segments={segments}
          eventRowCount={eventRowCount}
          selectedDay={selectedDay}
          today={today}
          showPresence={showPresence}
          viewerId={viewerId}
          onSelectDay={onSelectDay}
          isMobile
        />
      </div>
      <div className="hidden sm:block">
        <WeekRowInner
          week={week}
          segments={segments}
          eventRowCount={eventRowCount}
          selectedDay={selectedDay}
          today={today}
          showPresence={showPresence}
          viewerId={viewerId}
          onSelectDay={onSelectDay}
          isMobile={false}
        />
      </div>
    </>
  )
}

function WeekRowInner({
  week,
  segments,
  eventRowCount,
  selectedDay,
  today,
  showPresence,
  viewerId,
  onSelectDay,
  isMobile,
}: {
  week: { days: MonthGridCell[] }
  segments: ReturnType<typeof layoutEventBarsForWeek>
  eventRowCount: number
  selectedDay: string | null
  today: Date
  showPresence: boolean
  viewerId: number | null
  onSelectDay: (day: string) => void
  isMobile: boolean
}) {
  const { headerH, barH, gap, padBottom, overflowH } = weekMetrics(isMobile)
  const maxEventRows = maxVisibleEventRows(isMobile)
  const maxPresenceRows = isMobile ? MAX_PRESENCE_ROWS_MOBILE : MAX_PRESENCE_ROWS_DESKTOP
  const hiddenEvents = countHiddenEventBars(eventRowCount, isMobile)
  const visibleEventSegments = segments.filter((s) => s.row < maxEventRows)
  const visibleEventRows = eventRowCount === 0 ? 0 : Math.min(maxEventRows, eventRowCount)

  const presenceCount = showPresence ? maxPresenceCountInWeek(week.days) : 0
  const visiblePresenceRows =
    presenceCount === 0 ? 0 : Math.min(maxPresenceRows, presenceCount)
  const hiddenPresence = Math.max(0, presenceCount - maxPresenceRows)

  const presenceSegments = useMemo(() => {
    if (!showPresence || visiblePresenceRows === 0) return []
    return layoutPresenceBarsForWeek(week.days, viewerId, visibleEventRows).filter(
      (s) => s.row - visibleEventRows < visiblePresenceRows
    )
  }, [showPresence, visiblePresenceRows, visibleEventRows, week.days, viewerId])

  const barAreaTop = headerH + gap
  const contentRowCount = visibleEventRows + visiblePresenceRows
  const overflowBlockH =
    (hiddenEvents > 0 ? overflowH : 0) + (hiddenPresence > 0 ? overflowH : 0)
  const weekHeight =
    headerH +
    (contentRowCount > 0 ? gap : 0) +
    contentRowCount * (barH + gap) +
    overflowBlockH +
    padBottom

  const barTop = (row: number) => barAreaTop + row * (barH + gap)
  const overflowTop = barAreaTop + contentRowCount * (barH + gap) + gap

  return (
    <div className="relative" style={{ minHeight: weekHeight }}>
      {/* Fond cliquable */}
      <div className="absolute inset-0 z-0 grid grid-cols-7">
        {week.days.map((cell) => {
          const inMonth = cell.inMonth
          const selected = selectedDay === cell.day
          const disabled = cell.info?.is_disabled ?? false
          return (
            <button
              key={`bg-${cell.day}`}
              type="button"
              disabled={!inMonth}
              onClick={() => inMonth && onSelectDay(cell.day)}
              className={`border-r border-slate-800/40 last:border-r-0 text-left transition-colors ${
                inMonth ? 'hover:bg-slate-900/40' : 'bg-slate-950/30'
              } ${selected ? 'bg-violet-950/25 ring-1 ring-inset ring-violet-500/40' : ''} ${
                disabled && inMonth ? 'bg-slate-950/50' : ''
              }`}
              aria-label={cell.day}
              aria-pressed={selected}
            />
          )
        })}
      </div>

      {/* Barres d'événements */}
      {visibleEventSegments.map((seg) => (
        <div
          key={seg.key}
          className="absolute z-[1] px-[3px] pointer-events-none"
          style={{
            top: barTop(seg.row),
            left: `${(seg.startCol / 7) * 100}%`,
            width: `${(seg.span / 7) * 100}%`,
            height: barH,
          }}
        >
          <div
            className={`h-full flex items-center px-1.5 text-[10px] sm:text-[11px] font-medium truncate m-cal-event-bar ${phaseColor(
              seg.event.phase
            )} ${seg.roundLeft ? 'rounded-l-[4px]' : ''} ${seg.roundRight ? 'rounded-r-[4px]' : ''}`}
            title={seg.event.title}
          >
            <span className="truncate">{seg.showTitle ? seg.event.title : '\u00a0'}</span>
          </div>
        </div>
      ))}

      {/* Barres de présence */}
      {presenceSegments.map((seg) => (
        <div
          key={seg.key}
          className="absolute z-[1] px-[3px] pointer-events-none"
          style={{
            top: barTop(seg.row),
            left: `${(seg.dayCol / 7) * 100}%`,
            width: `${100 / 7}%`,
            height: barH,
          }}
        >
          <div
            className={`h-full flex items-center px-1.5 text-[10px] sm:text-[11px] font-medium truncate m-cal-event-bar ${seg.colorClass} rounded-[4px] ${
              seg.isMe ? 'ring-1 ring-emerald-400/60' : ''
            }`}
            title={seg.label}
          >
            <span className="truncate">{seg.label}</span>
          </div>
        </div>
      ))}

      {hiddenEvents > 0 && (
        <div
          className="absolute z-[1] left-0 right-0 text-[10px] text-slate-500 pl-2 pointer-events-none"
          style={{ top: overflowTop }}
        >
          +{hiddenEvents} événement{hiddenEvents > 1 ? 's' : ''}
        </div>
      )}

      {hiddenPresence > 0 && (
        <div
          className="absolute z-[1] left-0 right-0 text-[10px] text-slate-500 pl-2 pointer-events-none"
          style={{ top: overflowTop + (hiddenEvents > 0 ? overflowH : 0) }}
        >
          +{hiddenPresence} inscrit{hiddenPresence > 1 ? 's' : ''}
        </div>
      )}

      {/* Numéros du jour — toujours au-dessus */}
      <div
        className="absolute inset-x-0 top-0 z-20 grid grid-cols-7 pointer-events-none"
        style={{ height: headerH }}
      >
        {week.days.map((cell) => {
          const d = new Date(cell.day + 'T12:00:00')
          const isToday = isSameDay(d, today)
          const selected = selectedDay === cell.day
          const inMonth = cell.inMonth
          const disabled = cell.info?.is_disabled ?? false
          const iAmPresent = cell.info?.i_am_present ?? false
          const presentCount = cell.info?.present_count ?? 0

          return (
            <div
              key={`hdr-${cell.day}`}
              className={`flex items-start justify-between gap-0.5 px-2 pt-1.5 border-r border-transparent last:border-r-0 ${
                selected ? 'bg-violet-950/25' : inMonth ? 'bg-slate-950/90' : 'bg-slate-950/70'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center min-w-[28px] h-[28px] rounded-full text-sm font-semibold shrink-0 ${
                  isToday
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40'
                    : inMonth
                      ? 'text-slate-100'
                      : 'text-slate-600'
                } ${iAmPresent && showPresence && inMonth && !isToday ? 'ring-2 ring-emerald-500/60' : ''}`}
              >
                {d.getDate()}
              </span>
              {showPresence && inMonth && presentCount > 0 && !iAmPresent && (
                <span className="text-[9px] text-slate-500 mt-1.5 shrink-0 tabular-nums">{presentCount}</span>
              )}
              {disabled && inMonth && (
                <span className="text-[9px] text-slate-600 mt-1 shrink-0" title="Fermé">
                  ⊘
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function isSameDay(d: Date, today: Date): boolean {
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}
