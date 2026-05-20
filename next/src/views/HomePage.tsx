'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { eventsApi } from '@/api/events'
import { EVENT_PHASES } from '@/lib/event-constants'
import { formatMandalaDate, parseMandalaDateTime } from '@/lib/format-datetime'
import { ApiError } from '@/lib/api-client'
import { CommunityAvatar } from '@/components/CommunityAvatar'

type EventPreview = {
  id: number
  title: string
  phase: string
  starts_at: string | null
  location: string | null
}

function phaseLabel(id: string) {
  return EVENT_PHASES.find((p) => p.id === id)?.label ?? id
}

export function HomePage({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { active } = useCommunity()
  const { items: notifs, fetchList } = useNotifications()
  const [events, setEvents] = useState<EventPreview[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const accent = active?.accent_color ?? '#7c3aed'

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    try {
      const [evRes] = await Promise.all([
        eventsApi.list(active.slug) as Promise<{ events?: EventPreview[]; can_manage?: boolean }>,
        fetchList({ per_page: 5 }),
      ])
      setEvents(evRes.events ?? [])
      setCanManage(!!evRes.can_manage)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug, fetchList])

  useEffect(() => {
    void load()
  }, [load])

  const upcoming = events
    .filter((e) => {
      if (!e.starts_at) return e.phase !== 'closed'
      const d = parseMandalaDateTime(e.starts_at)
      return d ? d.getTime() >= Date.now() - 86400000 : true
    })
    .slice(0, 3)

  const recentNotifs = notifs.slice(0, 3)

  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex gap-4 items-start">
        {active && (
          <CommunityAvatar
            avatar={active.avatar}
            logoEmoji={active.logo_emoji}
            accentColor={active.accent_color}
            size="lg"
            alt={active.name}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-400">Bienvenue dans</p>
          <h1 className="text-3xl font-bold mt-1" style={{ color: accent }}>
            {active?.name ?? 'Mandala'}
          </h1>
          {active?.tagline && <p className="text-slate-400 mt-2">{active.tagline}</p>}
          {active?.location && (
            <p className="text-sm text-slate-500 mt-1">📍 {active.location}</p>
          )}
        </div>
      </header>

      {active?.description && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">À propos</h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{active.description}</p>
          {(active.website || active.contact_email) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {active.website && (
                <a
                  href={active.website.startsWith('http') ? active.website : `https://${active.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:underline"
                >
                  Site web
                </a>
              )}
              {active.contact_email && (
                <a href={`mailto:${active.contact_email}`} className="text-violet-400 hover:underline">
                  {active.contact_email}
                </a>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">À venir</h2>
          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="text-xs text-violet-400 hover:underline"
          >
            Tous les événements →
          </button>
        </div>
        {loading && <p className="text-sm text-slate-500">Chargement…</p>}
        {!loading && upcoming.length === 0 && (
          <p className="text-sm text-slate-500 italic">Aucun événement à venir.</p>
        )}
        <ul className="space-y-2">
          {upcoming.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => onNavigate('events', { eventId: ev.id })}
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-violet-500/40 transition-colors"
              >
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <p className="font-medium">{ev.title}</p>
                    <p className="text-xs text-violet-300/80 mt-0.5">{phaseLabel(ev.phase)}</p>
                    {ev.location && <p className="text-xs text-slate-500 mt-0.5">📍 {ev.location}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{formatMandalaDate(ev.starts_at)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <div className="rounded-xl border border-violet-600/30 bg-violet-950/20 p-4">
          <p className="text-sm text-violet-200 font-medium">Vous organisez ?</p>
          <p className="text-xs text-slate-400 mt-1">Créez un événement, assignez l&apos;équipe et suivez les tâches.</p>
          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="mt-3 text-sm px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
          >
            Gérer les événements
          </button>
        </div>
      )}

      <section className="grid sm:grid-cols-2 gap-3">
        <QuickCard title="Membres" desc="Annuaire de la communauté" onClick={() => onNavigate('members')} />
        <QuickCard title="Messages" desc="Conversations entre membres" onClick={() => onNavigate('messages')} />
      </section>

      {recentNotifs.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Annonces récentes</h2>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="text-xs text-violet-400 hover:underline"
            >
              Centre d&apos;alertes →
            </button>
          </div>
          <ul className="space-y-2">
            {recentNotifs.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              >
                <p className="font-medium truncate">{n.title}</p>
                {n.body && <p className="text-xs text-slate-500 truncate">{n.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function QuickCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-violet-500/50 transition-colors"
    >
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </button>
  )
}
