'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { eventsApi } from '@/api/events'
import {
  type HomeEventPreview,
  descriptionExcerpt,
  formatEventDateRange,
  isEventOnDay,
  pickFeaturedEvent,
  pickOtherUpcoming,
} from '@/lib/event-preview'
import { parseMandalaDateTime } from '@/lib/format-datetime'
import { isAvatarImageUrl } from '@/lib/user-avatar'
import { AgoraFeed } from '@/components/community/AgoraFeed'
import { PlaceAnnouncementsSection } from '@/components/place/PlaceAnnouncementsSection'
import { TodayBoard } from '@/components/place/TodayBoard'
import { EventPreviewCard } from '@/components/events/EventPreviewCard'
import { EventDetailModal } from '@/components/events/EventDetailModal'

function eventDateParts(startsAt: string | null): { day: string; month: string } | null {
  const d = parseMandalaDateTime(startsAt)
  if (!d) return null
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
  }
}

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
      const evRes = (await eventsApi.list(active.slug)) as {
        events?: HomeEventPreview[]
        can_manage?: boolean
      }
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

  useEffect(() => {
    if (!active?.slug) return
    const onEventsChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ communitySlug?: string }>).detail
      if (detail?.communitySlug !== active.slug) return
      void load()
    }
    window.addEventListener('mandala-events-changed', onEventsChanged)
    return () => window.removeEventListener('mandala-events-changed', onEventsChanged)
  }, [active?.slug, load])

  const featuredEvent = pickFeaturedEvent(events)
  const otherUpcoming = pickOtherUpcoming(events, featuredEvent)
  const featuredIsToday = featuredEvent ? isEventOnDay(featuredEvent) : false
  const heroImage = isAvatarImageUrl(active?.avatar)
    ? active!.avatar!
    : featuredEvent?.cover_image || null

  const shortcuts = [
    { icon: '🗓️', title: 'Calendrier', text: 'Présences et rythme du lieu', go: () => onNavigate('calendar') },
    { icon: '👥', title: 'Membres', text: 'Annuaire de la communauté', go: () => onNavigate('members') },
    { icon: '💬', title: 'Messages', text: 'Conversations entre membres', go: () => onNavigate('messages') },
    {
      icon: '☀️',
      title: 'Vie du lieu',
      text: 'Courses, logistique, cercles',
      go: () => document.getElementById('vie-du-lieu')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ]

  const locationLine = active?.location?.trim() || ''
  const tagline = active?.tagline?.trim() || ''
  const locationCore = locationLine.toLowerCase().replace(/,?\s*france$/i, '').trim()
  const showLocation = !!locationLine && (!tagline || !tagline.toLowerCase().includes(locationCore))

  return (
    <div className="m-landing m-home pb-10">
      <section className="m-home-hero mx-4 sm:mx-6 lg:mx-8 mt-4 sm:mt-6 rounded-[1.35rem]">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="" className="m-home-hero-media" />
        ) : (
          <div
            className="m-home-hero-media"
            style={{ background: `linear-gradient(135deg, ${accent}66, rgb(var(--slate-900)))` }}
          />
        )}
        <div className="m-home-hero-wash" />
        <div className="m-home-hero-copy space-y-4">
          <p className="m-landing-eyebrow">Bienvenue</p>
          <h1 className="m-landing-hero-title m-home-hero-title">{active?.name ?? 'Mandala'}</h1>
          {tagline && (
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">{tagline}</p>
          )}
          {showLocation && <p className="text-sm text-slate-400">📍 {locationLine}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => onNavigate('calendar')} className="m-landing-btn">
              Ouvrir l&apos;agenda
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById('vie-du-lieu')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="m-landing-btn m-landing-btn--ghost"
            >
              Vie du jour
            </button>
          </div>
        </div>
      </section>

      <div className="w-full px-4 sm:px-6 lg:px-8 space-y-16 pt-10">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {shortcuts.map((s) => (
            <button key={s.title} type="button" onClick={s.go} className="m-landing-icon-card hover:opacity-90 transition-opacity">
              <div className="m-landing-icon-mark" aria-hidden>
                {s.icon}
              </div>
              <h3 className="text-xl mb-1.5">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.text}</p>
            </button>
          ))}
        </section>

        {(loading || featuredEvent) && (
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <p className="m-landing-eyebrow">Programmes</p>
              <h2 className="text-3xl sm:text-4xl">
                {featuredIsToday ? 'Événement du jour' : 'Prochain rendez-vous'}
              </h2>
            </div>
            {loading && <p className="text-sm text-slate-500 text-center">Chargement…</p>}
            {!loading && featuredEvent && (
              <div className="m-home-program">
                <div className="overflow-hidden rounded-[1.35rem] border border-slate-800 bg-slate-950 min-h-[14rem]">
                  {featuredEvent.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featuredEvent.cover_image}
                      alt=""
                      className="w-full h-full object-cover min-h-[14rem] max-h-80"
                    />
                  ) : (
                    <div className="h-full min-h-[14rem] flex items-center justify-center p-8">
                      <EventPreviewCard
                        event={featuredEvent}
                        variant="hero"
                        onClick={() => setSelectedEventId(featuredEvent.id)}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <p className="m-landing-eyebrow">
                    {featuredIsToday ? 'Aujourd’hui' : 'À venir'}
                  </p>
                  <h3 className="text-3xl sm:text-4xl text-slate-100">{featuredEvent.title}</h3>
                  <p className="text-sm text-slate-400">
                    {formatEventDateRange(featuredEvent.starts_at, featuredEvent.ends_at)}
                    {featuredEvent.location ? ` · ${featuredEvent.location}` : ''}
                  </p>
                  {descriptionExcerpt(featuredEvent.description, 220) && (
                    <p className="text-slate-300 leading-relaxed">
                      {descriptionExcerpt(featuredEvent.description, 220)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(featuredEvent.id)}
                    className="m-landing-btn"
                  >
                    En savoir plus
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && !featuredEvent && (
          <section className="text-center space-y-3 py-6">
            <p className="m-landing-eyebrow">Programmes</p>
            <h2 className="text-3xl">Aucun rendez-vous pour l’instant</h2>
            <p className="text-slate-400 text-sm">Revenez bientôt ou consultez le calendrier du lieu.</p>
            <button type="button" onClick={() => onNavigate('events')} className="m-landing-btn mt-2">
              Voir le calendrier
            </button>
          </section>
        )}

        <section id="vie-du-lieu" className="scroll-mt-24 space-y-5">
          <div className="text-center space-y-2">
            <p className="m-landing-eyebrow">Aujourd’hui</p>
            <h2 className="text-3xl sm:text-4xl">Vie du lieu</h2>
          </div>
          <TodayBoard onNavigate={onNavigate} onOpenEvent={(id) => setSelectedEventId(id)} />
        </section>

        <section className="space-y-5">
          <div className="text-center space-y-2">
            <p className="m-landing-eyebrow">Annonces</p>
            <h2 className="text-3xl sm:text-4xl">Actualités du lieu</h2>
          </div>
          <PlaceAnnouncementsSection onNavigate={onNavigate} />
        </section>

        {otherUpcoming.length > 0 && (
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <p className="m-landing-eyebrow">Agenda</p>
              <h2 className="text-3xl sm:text-4xl">Événements à venir</h2>
            </div>
            <ul className="space-y-3">
              {otherUpcoming.slice(0, 5).map((ev) => {
                const parts = eventDateParts(ev.starts_at)
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className="m-landing-card w-full text-left px-4 py-3.5 flex items-center gap-4 hover:border-violet-500/40 transition-colors"
                    >
                      {parts ? (
                        <span className="m-home-date">
                          <span className="m-home-date-day">{parts.day}</span>
                          <span className="m-home-date-month">{parts.month}</span>
                        </span>
                      ) : (
                        <span className="m-home-date">
                          <span className="m-home-date-month">Date</span>
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg text-slate-100 leading-snug">{ev.title}</span>
                        <span className="block text-sm text-slate-400 mt-0.5">
                          {formatEventDateRange(ev.starts_at, ev.ends_at)}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </span>
                      </span>
                      <span className="hidden sm:inline text-[10px] uppercase tracking-[0.16em] text-violet-300 shrink-0">
                        Infos
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="text-center">
              <button type="button" onClick={() => onNavigate('events')} className="m-landing-btn">
                Tous les événements
              </button>
            </div>
          </section>
        )}

        <section className="space-y-5">
          <div className="text-center space-y-2">
            <p className="m-landing-eyebrow">Agora</p>
            <h2 className="text-3xl sm:text-4xl">Le mur de la communauté</h2>
          </div>
          <AgoraFeed />
        </section>

        {active?.description && (
          <section className="m-landing-card p-6 sm:p-8 space-y-3">
            <p className="m-landing-eyebrow">À propos</p>
            <h2 className="text-3xl">{active.name}</h2>
            <p className="text-slate-300 text-sm sm:text-base whitespace-pre-wrap leading-relaxed">
              {active.description}
            </p>
            {(active.website || active.contact_email) && (
              <div className="flex flex-wrap gap-3 pt-2">
                {active.website && (
                  <a
                    href={active.website.startsWith('http') ? active.website : `https://${active.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="m-landing-btn"
                  >
                    Site web
                  </a>
                )}
                {active.contact_email && (
                  <a href={`mailto:${active.contact_email}`} className="m-landing-btn m-landing-btn--ghost">
                    {active.contact_email}
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        {canManage && (
          <section
            className="rounded-[1.5rem] px-6 py-10 text-center space-y-4"
            style={{
              background: `linear-gradient(180deg, ${accent}33, rgb(var(--slate-950) / 0.4))`,
            }}
          >
            <p className="m-landing-eyebrow">Organisation</p>
            <h2 className="text-3xl sm:text-4xl">Vous organisez ce lieu</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Créez un événement, assignez l&apos;équipe et suivez les tâches.
            </p>
            <button type="button" onClick={() => onNavigate('events')} className="m-landing-btn">
              Créer un événement
            </button>
          </section>
        )}
      </div>

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
