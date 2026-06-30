'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { eventsApi } from '@/api/events'
import {
  type HomeEventPreview,
  isEventOnDay,
  pickFeaturedEvent,
  pickOtherUpcoming,
} from '@/lib/event-preview'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { AgoraFeed } from '@/components/community/AgoraFeed'
import { FeedSection } from '@/components/community/FeedSection'
import { PlaceAnnouncementsSection } from '@/components/place/PlaceAnnouncementsSection'
import { EventPreviewCard } from '@/components/events/EventPreviewCard'
import { EventDetailModal } from '@/components/events/EventDetailModal'

export function HomePage({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { active } = useCommunity()
  const [events, setEvents] = useState<HomeEventPreview[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const accent = active?.accent_color ?? '#7c3aed'

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    try {
      const [evRes] = await Promise.all([
        eventsApi.list(active.slug) as Promise<{ events?: HomeEventPreview[]; can_manage?: boolean }>,
      ])
      setEvents(evRes.events ?? [])
      setCanManage(!!evRes.can_manage)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void load()
  }, [load])

  const featuredEvent = pickFeaturedEvent(events)
  const otherUpcoming = pickOtherUpcoming(events, featuredEvent)
  const featuredIsToday = featuredEvent ? isEventOnDay(featuredEvent) : false

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex gap-4 items-start pb-1">
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
          {active?.tagline && <p className="text-slate-300 mt-2 text-base">{active.tagline}</p>}
          {active?.location && (
            <p className="text-sm text-slate-500 mt-1">📍 {active.location}</p>
          )}
        </div>
      </header>

      <PlaceAnnouncementsSection onNavigate={onNavigate} />

      {(loading || featuredEvent) && (
        <FeedSection
          icon="📅"
          title={featuredIsToday ? 'Événement du jour' : 'Prochain événement'}
          subtitle={
            featuredIsToday
              ? 'En cours ou prévu aujourd’hui'
              : 'Le prochain rendez-vous de la communauté'
          }
          tone="custom"
          accentColor={accent}
          action={
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="text-sm hover:underline font-medium"
              style={{ color: accent }}
            >
              Calendrier →
            </button>
          }
        >
          {loading && <p className="text-sm text-slate-500">Chargement…</p>}
          {!loading && featuredEvent && (
            <EventPreviewCard
              event={featuredEvent}
              variant="hero"
              onClick={() => setSelectedEventId(featuredEvent.id)}
            />
          )}
        </FeedSection>
      )}

      {!loading && !featuredEvent && (
        <FeedSection
          icon="📅"
          title="Événement du jour"
          subtitle="Aucun rendez-vous prévu pour le moment"
          tone="custom"
          accentColor={accent}
        >
          <p className="text-base text-slate-500 italic">
            Aucun événement à venir. Revenez bientôt ou consultez le calendrier.
          </p>
        </FeedSection>
      )}

      <AgoraFeed />

      {otherUpcoming.length > 0 && (
        <FeedSection
          icon="🗓️"
          title="Prochains événements"
          subtitle={`${otherUpcoming.length} autre${otherUpcoming.length > 1 ? 's' : ''} à venir`}
          tone="slate"
          action={
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="text-sm text-slate-400 hover:text-violet-300 hover:underline font-medium"
            >
              Tout voir →
            </button>
          }
        >
          <ul className="space-y-2">
            {otherUpcoming.slice(0, 4).map((ev) => (
              <li key={ev.id}>
                <EventPreviewCard
                  event={ev}
                  variant="compact"
                  onClick={() => setSelectedEventId(ev.id)}
                />
              </li>
            ))}
          </ul>
        </FeedSection>
      )}

      <section className="grid sm:grid-cols-2 gap-3">
        <QuickCard title="Membres" desc="Annuaire de la communauté" onClick={() => onNavigate('members')} />
        <QuickCard title="Messages" desc="Conversations entre membres" onClick={() => onNavigate('messages')} />
      </section>

      {active?.description && (
        <details className="rounded-xl border border-slate-800 bg-slate-900/30">
          <summary className="px-4 py-3 text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-300">
            À propos de {active.name}
          </summary>
          <div className="px-4 pb-4 border-t border-slate-800/80 pt-3">
            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{active.description}</p>
            {(active.website || active.contact_email) && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
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
          </div>
        </details>
      )}

      {canManage && (
        <div className="rounded-xl border border-violet-600/30 bg-violet-950/20 p-4">
          <p className="text-sm text-violet-200 font-medium">Vous organisez ce lieu</p>
          <p className="text-xs text-slate-400 mt-1">
            Créez un événement, assignez l&apos;équipe et suivez les tâches.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="mt-3 text-sm px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
          >
            + Créer un événement
          </button>
        </div>
      )}

      {selectedEventId != null && (
        <EventDetailModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onOpenFull={() => {
            const id = selectedEventId
            setSelectedEventId(null)
            onNavigate('events', { eventId: id })
          }}
        />
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
      <p className="font-semibold text-base text-slate-100">{title}</p>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </button>
  )
}
