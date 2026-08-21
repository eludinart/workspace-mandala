'use client'

import type { EventSpanPosition } from '@/lib/event-dates'
import { formatMandalaDateTime, parseMandalaDateTime } from '@/lib/format-datetime'

export type PresentUser = {
  user_id: number
  pseudo: string
  display_name: string
}

export type CalendarViewMode = 'month' | 'week'

export type MonthEvent = {
  id: number
  title: string
  starts_at: string | null
  ends_at: string | null
  location: string | null
  phase: string
}

export type DayEvent = MonthEvent & { spanPosition: EventSpanPosition }

export type MonthDay = {
  day: string
  is_disabled: boolean
  max_participants: number
  present_count: number
  i_am_present: boolean
  present_users: PresentUser[]
}

export type MonthData = {
  ym: string
  settings: { show_presence: boolean; show_events: boolean }
  days: MonthDay[]
  events: MonthEvent[]
  can_manage?: boolean
}

const USER_BAR_COLORS = [
  'bg-violet-600',
  'bg-amber-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-orange-600',
  'bg-teal-600',
  'bg-fuchsia-600',
]

export function userBarColor(userId: number): string {
  return USER_BAR_COLORS[Math.abs(userId) % USER_BAR_COLORS.length]
}

export function displayLabel(u: PresentUser, viewerId: number | null): string {
  if (viewerId != null && u.user_id === viewerId) return u.pseudo || u.display_name || 'Moi'
  return u.pseudo || u.display_name || `user_${u.user_id}`
}

export function ymToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(y, m - 1 + delta, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabelFr(ym: string): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(y, m - 1, 1)
  return dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function dayLabelFr(day: string): string {
  const d = dayToDate(day)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function weekdayHeadersFr(short = false): string[] {
  const base = new Date(Date.UTC(2026, 0, 5))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    if (short) {
      return d.toLocaleDateString('fr-FR', { weekday: 'narrow' }).replace('.', '')
    }
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  })
}

export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map((x) => parseInt(x, 10))
  return new Date(y, m - 1, d)
}

export function dateToDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function phaseColor(phase: string): string {
  switch (phase) {
    case 'day':
      return 'bg-amber-500'
    case 'after':
      return 'bg-sky-500'
    case 'closed':
      return 'bg-slate-500'
    default:
      return 'bg-violet-500'
  }
}

export function phaseSoftBg(phase: string): string {
  switch (phase) {
    case 'day':
      return 'bg-amber-500/15 border-amber-500/30 text-amber-950 dark:text-amber-100'
    case 'after':
      return 'bg-sky-500/15 border-sky-500/30 text-sky-950 dark:text-sky-100'
    case 'closed':
      return 'bg-slate-500/15 border-slate-500/30 text-slate-800 dark:text-slate-300'
    default:
      return 'bg-violet-500/15 border-violet-500/30 text-violet-950 dark:text-violet-100'
  }
}

export function formatEventTime(ev: MonthEvent): string {
  const start = formatMandalaDateTime(ev.starts_at)
  if (!ev.ends_at || ev.ends_at === ev.starts_at) return start
  return `${start} → ${formatMandalaDateTime(ev.ends_at)}`
}

export function dayToYm(day: string): string {
  return day.slice(0, 7)
}

/** Lundi de la semaine contenant `day` (YYYY-MM-DD). */
export function startOfWeekMonday(day: string): string {
  const d = dayToDate(day)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return dateToDay(d)
}

export function addDays(day: string, delta: number): string {
  const d = dayToDate(day)
  d.setDate(d.getDate() + delta)
  return dateToDay(d)
}

export function addWeeks(day: string, delta: number): string {
  return addDays(day, delta * 7)
}

/** Les 7 jours à partir du lundi `weekStart`. */
export function weekDaysFromMonday(weekStart: string): string[] {
  const start = startOfWeekMonday(weekStart)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function weekLabelFr(weekStart: string): string {
  const days = weekDaysFromMonday(weekStart)
  const first = dayToDate(days[0])
  const last = dayToDate(days[6])
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  if (sameMonth) {
    return `${first.getDate()} – ${last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  const a = first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const b = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${a} – ${b}`
}

export function shortWeekdayFr(day: string): string {
  return dayToDate(day).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
}

export function formatEventShortTime(startsAt: string | null): string {
  const d = parseMandalaDateTime(startsAt)
  if (!d) return ''
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function mergeMonthData(results: MonthData[]): MonthData | null {
  if (results.length === 0) return null
  const daysMap = new Map<string, MonthDay>()
  const eventsMap = new Map<number, MonthEvent>()
  for (const r of results) {
    for (const d of r.days) daysMap.set(d.day, d)
    for (const e of r.events) eventsMap.set(e.id, e)
  }
  const first = results[0]
  return {
    ym: first.ym,
    settings: first.settings,
    days: [...daysMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    events: [...eventsMap.values()],
    can_manage: results.some((r) => r.can_manage),
  }
}

export function ymsForWeek(weekStart: string): string[] {
  const days = weekDaysFromMonday(weekStart)
  return [...new Set(days.map(dayToYm))]
}
