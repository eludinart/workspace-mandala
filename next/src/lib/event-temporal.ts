/** Statut calendrier d'un événement (serveur + client). */

import { getEventEffectiveEnd } from './event-dates'
import { parseMandalaDateTime } from './format-datetime'

export type EventTemporalInput = {
  starts_at: string | null
  ends_at: string | null
  phase: string
}

export function isEventUpcoming(ev: EventTemporalInput): boolean {
  if (ev.phase === 'closed') return false
  const end = getEventEffectiveEnd(ev.starts_at, ev.ends_at)
  if (end) return end.getTime() >= Date.now()
  if (!ev.starts_at) return true
  const start = parseMandalaDateTime(ev.starts_at)
  return start ? start.getTime() >= Date.now() - 86400000 : true
}

export function isEventOngoing(ev: EventTemporalInput): boolean {
  if (ev.phase === 'closed') return false
  const start = parseMandalaDateTime(ev.starts_at)
  const end = getEventEffectiveEnd(ev.starts_at, ev.ends_at)
  if (!start || !end) return false
  const now = Date.now()
  return start.getTime() <= now && end.getTime() >= now
}

export function isEventPast(ev: EventTemporalInput): boolean {
  return !isEventUpcoming(ev) && !isEventOngoing(ev)
}

export function eventTemporalBadge(ev: EventTemporalInput): { label: string; className: string } {
  if (isEventPast(ev)) {
    return {
      label: 'Passé',
      className: 'bg-slate-800/90 text-slate-400 border-slate-600/50',
    }
  }
  if (isEventOngoing(ev)) {
    return {
      label: 'En cours',
      className: 'bg-emerald-950/70 text-emerald-200 border-emerald-600/45',
    }
  }
  return {
    label: 'À venir',
    className: 'bg-violet-950/60 text-violet-200 border-violet-600/40',
  }
}
