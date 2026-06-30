'use client'

import { EVENT_PHASES } from '@/lib/event-constants'
import { dateToDayKey, enumerateEventDays, getEventEffectiveEnd } from '@/lib/event-dates'
import { formatMandalaDate, formatMandalaDateTime, parseMandalaDateTime } from '@/lib/format-datetime'

export type HomeEventPreview = {
  id: number
  title: string
  description: string | null
  phase: string
  starts_at: string | null
  ends_at: string | null
  location: string | null
  cover_image: string | null
  media_count?: number
}

export function phaseLabel(id: string): string {
  return EVENT_PHASES.find((p) => p.id === id)?.label ?? id
}

export function phaseBadgeClass(phase: string): string {
  switch (phase) {
    case 'day':
      return 'bg-amber-950/60 text-amber-200 border-amber-700/40'
    case 'after':
      return 'bg-sky-950/60 text-sky-200 border-sky-700/40'
    case 'closed':
      return 'bg-slate-800/80 text-slate-400 border-slate-600/40'
    default:
      return 'bg-violet-950/60 text-violet-200 border-violet-700/40'
  }
}

export function isEventUpcoming(ev: {
  starts_at: string | null
  ends_at: string | null
  phase: string
}): boolean {
  if (ev.phase === 'closed') return false
  const end = getEventEffectiveEnd(ev.starts_at, ev.ends_at)
  if (end) return end.getTime() >= Date.now()
  if (!ev.starts_at) return true
  const start = parseMandalaDateTime(ev.starts_at)
  return start ? start.getTime() >= Date.now() - 86400000 : true
}

export function formatEventDateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return 'Date à préciser'
  const start = parseMandalaDateTime(startsAt)
  const end = parseMandalaDateTime(endsAt)
  if (!start) return formatMandalaDate(startsAt)
  if (!end || end.getTime() <= start.getTime()) {
    return formatMandalaDateTime(startsAt)
  }
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  if (sameDay) {
    return `${formatMandalaDateTime(startsAt)} → ${end.toLocaleTimeString('fr-FR', { timeStyle: 'short' })}`
  }
  return `${formatMandalaDateTime(startsAt)} → ${formatMandalaDateTime(endsAt)}`
}

export function descriptionExcerpt(text: string | null, max = 140): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`
}

export function isEventOnDay(
  ev: { starts_at: string | null; ends_at: string | null },
  day: Date = new Date(),
): boolean {
  const key = dateToDayKey(day)
  return enumerateEventDays(ev.starts_at, ev.ends_at).includes(key)
}

export function sortEventsByStart(events: HomeEventPreview[]): HomeEventPreview[] {
  return [...events].sort((a, b) => {
    const ta = parseMandalaDateTime(a.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = parseMandalaDateTime(b.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER
    return ta - tb
  })
}

export function pickFeaturedEvent(events: HomeEventPreview[]): HomeEventPreview | null {
  const upcoming = sortEventsByStart(events.filter(isEventUpcoming))
  const today = upcoming.find((ev) => isEventOnDay(ev))
  return today ?? upcoming[0] ?? null
}

export function pickOtherUpcoming(
  events: HomeEventPreview[],
  featured: HomeEventPreview | null,
): HomeEventPreview[] {
  return sortEventsByStart(events.filter(isEventUpcoming)).filter((ev) => ev.id !== featured?.id)
}
