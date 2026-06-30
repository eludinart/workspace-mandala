import { enumerateEventDays } from '@/lib/event-dates'
import type { MonthDay, MonthEvent, PresentUser } from '@/components/calendar/calendar-utils'
import { displayLabel, userBarColor } from '@/components/calendar/calendar-utils'

export type MonthGridCell = { day: string; inMonth: boolean; info?: MonthDay }

export type MonthWeekRow = {
  days: MonthGridCell[]
}

export type EventBarSegment = {
  key: string
  event: MonthEvent
  startCol: number
  span: number
  row: number
  roundLeft: boolean
  roundRight: boolean
  showTitle: boolean
}

const MAX_STACK_ROWS_MOBILE = 2
const MAX_STACK_ROWS_DESKTOP = 4

export function splitGridIntoWeeks(grid: MonthGridCell[]): MonthWeekRow[] {
  const weeks: MonthWeekRow[] = []
  for (let i = 0; i < grid.length; i += 7) {
    weeks.push({ days: grid.slice(i, i + 7) })
  }
  return weeks
}

function eventIntersectsWeek(event: MonthEvent, weekDays: string[]): boolean {
  const days = enumerateEventDays(event.starts_at, event.ends_at)
  if (days.length === 0) return false
  const set = new Set(weekDays)
  return days.some((d) => set.has(d))
}

function segmentForEventInWeek(event: MonthEvent, weekDays: string[]): Omit<EventBarSegment, 'row' | 'key'> | null {
  const eventDays = enumerateEventDays(event.starts_at, event.ends_at)
  if (eventDays.length === 0) return null

  const indices: number[] = []
  for (let i = 0; i < weekDays.length; i++) {
    if (eventDays.includes(weekDays[i])) indices.push(i)
  }
  if (indices.length === 0) return null

  const startCol = indices[0]
  const endCol = indices[indices.length - 1]
  const span = endCol - startCol + 1
  const eventStart = eventDays[0]
  const eventEnd = eventDays[eventDays.length - 1]

  return {
    event,
    startCol,
    span,
    roundLeft: weekDays[startCol] === eventStart,
    roundRight: weekDays[endCol] === eventEnd,
    showTitle: weekDays[startCol] === eventStart || startCol === 0,
  }
}

function segmentsOverlap(a: Pick<EventBarSegment, 'startCol' | 'span'>, b: Pick<EventBarSegment, 'startCol' | 'span'>): boolean {
  return a.startCol < b.startCol + b.span && b.startCol < a.startCol + a.span
}

/** Empile les barres d'événements pour une semaine (style Google Calendar). */
export function layoutEventBarsForWeek(weekDays: string[], events: MonthEvent[]): EventBarSegment[] {
  const raw: Omit<EventBarSegment, 'row'>[] = []
  for (const event of events) {
    if (!eventIntersectsWeek(event, weekDays)) continue
    const seg = segmentForEventInWeek(event, weekDays)
    if (!seg) continue
    raw.push({
      ...seg,
      key: `${event.id}-${weekDays[0]}-${seg.startCol}`,
    })
  }

  raw.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.span - a.span
  })

  const rows: EventBarSegment[][] = []
  const placed: EventBarSegment[] = []

  for (const seg of raw) {
    let rowIdx = 0
    while (true) {
      const row = rows[rowIdx] ?? []
      const conflict = row.some((existing) => segmentsOverlap(existing, seg))
      if (!conflict) {
        if (!rows[rowIdx]) rows[rowIdx] = []
        const placedSeg = { ...seg, row: rowIdx }
        rows[rowIdx].push(placedSeg)
        placed.push(placedSeg)
        break
      }
      rowIdx++
    }
  }

  return placed
}

export function countHiddenEventBars(totalRows: number, isMobile: boolean): number {
  const max = isMobile ? MAX_STACK_ROWS_MOBILE : MAX_STACK_ROWS_DESKTOP
  return Math.max(0, totalRows - max)
}

export function maxVisibleEventRows(isMobile: boolean): number {
  return isMobile ? MAX_STACK_ROWS_MOBILE : MAX_STACK_ROWS_DESKTOP
}

export function totalEventRowsInWeek(segments: EventBarSegment[]): number {
  if (segments.length === 0) return 0
  return Math.max(...segments.map((s) => s.row)) + 1
}

/** Présences : une barre par personne sur un seul jour (empilées sous les événements). */
export type PresenceBarSegment = {
  key: string
  dayCol: number
  row: number
  label: string
  userId: number
  isMe: boolean
  colorClass: string
}

export function maxPresenceCountInWeek(days: MonthGridCell[]): number {
  let max = 0
  for (const cell of days) {
    if (!cell.inMonth) continue
    max = Math.max(max, cell.info?.present_users?.length ?? 0)
  }
  return max
}

export function layoutPresenceBarsForWeek(
  days: MonthGridCell[],
  viewerId: number | null,
  eventRowOffset: number
): PresenceBarSegment[] {
  const placed: PresenceBarSegment[] = []
  for (let col = 0; col < days.length; col++) {
    const cell = days[col]
    if (!cell.inMonth) continue
    const users: PresentUser[] = cell.info?.present_users ?? []
    users.forEach((u, i) => {
      placed.push({
        key: `${cell.day}-${u.user_id}`,
        dayCol: col,
        row: eventRowOffset + i,
        label: displayLabel(u, viewerId),
        userId: u.user_id,
        isMe: viewerId != null && u.user_id === viewerId,
        colorClass: userBarColor(u.user_id),
      })
    })
  }
  return placed
}
