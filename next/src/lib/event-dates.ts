import { parseMandalaDateTime } from './format-datetime'

export type EventSpanPosition = 'single' | 'start' | 'middle' | 'end'

/** Date de fin effective : `ends_at` si postérieur au début, sinon le jour de début. */
export function getEventEffectiveEnd(startsAt: string | null, endsAt: string | null): Date | null {
  const start = parseMandalaDateTime(startsAt)
  if (!start) return null
  const end = parseMandalaDateTime(endsAt)
  if (!end || end.getTime() < start.getTime()) {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999)
  }
  return end
}

export function dateToDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Jours civils couverts par un événement (inclusifs). */
export function enumerateEventDays(startsAt: string | null, endsAt: string | null): string[] {
  const start = parseMandalaDateTime(startsAt)
  if (!start) return []
  const effectiveEnd = getEventEffectiveEnd(startsAt, endsAt)
  if (!effectiveEnd) return []

  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate())
  const days: string[] = []
  while (cur <= last) {
    days.push(dateToDayKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export function getEventSpanPosition(day: string, startDay: string, endDay: string): EventSpanPosition {
  if (startDay === endDay) return 'single'
  if (day === startDay) return 'start'
  if (day === endDay) return 'end'
  return 'middle'
}

export function assertEndsAfterStarts(startsAt: string | null | undefined, endsAt: string | null | undefined): void {
  if (!startsAt || !endsAt) return
  const start = parseMandalaDateTime(startsAt)
  const end = parseMandalaDateTime(endsAt)
  if (start && end && end.getTime() < start.getTime()) {
    throw new Error('La date de fin doit être postérieure ou égale au début.')
  }
}
