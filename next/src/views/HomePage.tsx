'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { usePlaceEvents } from '@/hooks/usePlaceEvents'
import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
import { queryKeys } from '@/lib/query-keys'
import {
  descriptionExcerpt,
  formatEventDateRange,
  isEventOnDay,
  pickFeaturedEvent,
  pickOtherUpcoming,
} from '@/lib/event-preview'
import {
  featuredProgramMediaKind,
  resolveFeaturedProgramImage,
} from '@/lib/featured-program-media'
import { parseWallClockDateTime } from '@/lib/format-datetime'
import { isAvatarImageUrl } from '@/lib/user-avatar'
import { AgoraFeed } from '@/components/community/AgoraFeed'
import { HeartWeatherHomeCard } from '@/components/community/HeartWeatherHomeCard'
import { PlaceAnnouncementsSection } from '@/components/place/PlaceAnnouncementsSection'
import { TodayBoard } from '@/components/place/TodayBoard'
import { EventDetailModal } from '@/components/events/EventDetailModal'
import { CommunitySwitcher } from '@/components/layout/CommunitySwitcher'
import { ExplainCard } from '@/components/help/ExplainCard'

function eventDateParts(startsAt: string | null): { day: string; month: string } | null {
  const d = parseWallClockDateTime(startsAt)
  if (!d) return null
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
  }
}

export function HomePage({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const queryClient = useQueryClient()
  const { active, refresh: refreshCommunities } = useCommunity()
  const eventsQuery = usePlaceEvents(active?.slug)

  const onPull = useCallback(async () => {
    await refreshCommunities({ background: true })
    if (active?.slug) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(active.slug) })
    }
    window.dispatchEvent(new CustomEvent('mandala-pull-refresh', { detail: { page: 'home' } }))
  }, [active?.slug, queryClient, refreshCommunities])
  useRegisterPullRefresh('home', onPull)
  const events = eventsQuery.data?.events ?? []
  const elsewhere = eventsQuery.data?.elsewhere ?? []
  const canManage = eventsQuery.data?.can_manage ?? false
  const loading = eventsQuery.isLoading
  const refreshing = eventsQuery.isFetching && !eventsQuery.isLoading
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  const accent = active?.accent_color ?? '#7c3aed'

  useEffect(() => {
    setSelectedEventId(null)
  }, [active?.slug])

  const featuredEvent = !loading ? pickFeaturedEvent(events) : null
  const otherUpcoming = !loading ? pickOtherUpcoming(events, featuredEvent) : []
  const elsewhereList = !loading ? pickOtherUpcoming(elsewhere, null) : []
  const featuredIsToday = featuredEvent ? isEventOnDay(featuredEvent) : false
  const featuredImage = featuredEvent ? resolveFeaturedProgramImage(featuredEvent) : null
  const featuredMediaKind = featuredProgramMediaKind(featuredImage)
  const featuredDateParts = featuredEvent ? eventDateParts(featuredEvent.starts_at) : null
  // Avatar du lieu actif seulement ; jamais le featured d’un lieu précédent pendant le load.
  const heroImage = isAvatarImageUrl(active?.avatar)
    ? active!.avatar!
    : featuredImage || null

  const shortcuts = [
    { icon: '🗓️', title: 'Calendrier', text: 'Présences et rythme du lieu', go: () => onNavigate('calendar') },
    { icon: '👥', title: 'Membres', text: 'Annuaire de la communauté', go: () => onNavigate('members') },
    { icon: '✨', title: 'Compétences', text: 'Savoir-faire des membres', go: () => onNavigate('skills') },
    { icon: '📚', title: 'Ressources', text: 'Recettes, textes, médias', go: () => onNavigate('resources') },
    { icon: '💬', title: 'Messages', text: 'Conversations entre membres', go: () => onNavigate('messages') },
    {
      icon: '☀️',
      title: 'Vie du lieu',
      text: 'Courses, logistique, cercles',
      go: () => document.getElementById('vie-du-lieu')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ]

  if (!active) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Sans lieu</p>
          <h1 className="text-2xl font-semibold text-slate-50">Votre espace</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Complétez votre fiche, apparaissez dans l’annuaire si vous le souhaitez, et rejoignez un lieu quand vous voulez.
          </p>
        </header>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="text-left rounded-2xl border border-violet-500/40 bg-violet-950/30 px-4 py-4 hover:border-violet-400/70"
          >
            <p className="font-medium text-slate-100">Rejoindre un lieu</p>
            <p className="text-sm text-slate-400 mt-1">Le lieu, sa charte, puis sa vie quotidienne.</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('directory')}
            className="text-left rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4 hover:border-slate-600"
          >
            <p className="font-medium text-slate-100">Annuaire</p>
            <p className="text-sm text-slate-400 mt-1">Les personnes visibles sur Mandala, avec ou sans lieu.</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('account')}
            className="text-left rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4 hover:border-slate-600"
          >
            <p className="font-medium text-slate-100">Ma fiche</p>
            <p className="text-sm text-slate-400 mt-1">Savoir-faire, ce que vous apportez, ce que vous cherchez.</p>
          </button>
        </div>
        <CommunitySwitcher open={joinOpen} onClose={() => setJoinOpen(false)} />
      </div>
    )
  }

  const locationLine = active?.location?.trim() || ''
  const tagline = active?.tagline?.trim() || ''
  const locationCore = locationLine.toLowerCase().replace(/,?\s*france$/i, '').trim()
  const showLocation = !!locationLine && (!tagline || !tagline.toLowerCase().includes(locationCore))

  return (
    <div className="m-landing m-home pb-10">
      <div className="mx-4 sm:mx-6 lg:mx-8 mt-4">
        <ExplainCard screen="home" />
      </div>
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

      <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 space-y-3">
        <ExplainCard screen="heart_weather" />
        <HeartWeatherHomeCard />
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 space-y-16 pt-10">
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
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
            {loading && (
              <p className="text-sm text-slate-500 text-center">
                Chargement des programmes{active?.name ? ` — ${active.name}` : ''}…
              </p>
            )}
            {refreshing && (
              <p className="text-xs text-slate-500 text-center" aria-live="polite">
                Actualisation…
              </p>
            )}
            {!loading && featuredEvent && (
              <div className="m-home-program">
                <button
                  type="button"
                  onClick={() => setSelectedEventId(featuredEvent.id)}
                  className="relative overflow-hidden rounded-[1.35rem] border border-slate-800 bg-slate-950 min-h-[14rem] max-h-80 w-full text-left hover:border-violet-500/40 transition-colors"
                  aria-label={`Ouvrir ${featuredEvent.title}`}
                >
                  {featuredMediaKind === 'image' && featuredImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featuredImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(145deg, ${accent}55, rgb(15 23 42), rgb(2 6 23))`,
                      }}
                    />
                  )}
                  {featuredMediaKind === 'image' && (
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/25 to-slate-950/10"
                      aria-hidden
                    />
                  )}
                  <div className="relative z-[1] min-h-[14rem] max-h-80 h-full flex items-center justify-center p-8">
                    {featuredDateParts ? (
                      <span className="m-home-date scale-150 origin-center shadow-lg shadow-black/30">
                        <span className="m-home-date-day">{featuredDateParts.day}</span>
                        <span className="m-home-date-month">{featuredDateParts.month}</span>
                      </span>
                    ) : (
                      <span className="text-5xl opacity-80" aria-hidden>
                        📅
                      </span>
                    )}
                  </div>
                </button>
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
          <ExplainCard screen="announcements" />
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

        {!loading && elsewhereList.length > 0 && (
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <p className="m-landing-eyebrow">Lieux amis</p>
              <h2 className="text-3xl sm:text-4xl">Ailleurs</h2>
            </div>
            <ul className="space-y-3">
              {elsewhereList.slice(0, 6).map((ev) => {
                const parts = eventDateParts(ev.starts_at)
                const hostAccent = ev.host_accent_color?.trim() || accent
                return (
                  <li key={`elsewhere-${ev.id}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className="m-landing-card w-full text-left px-4 py-3.5 flex items-center gap-4 transition-colors"
                      style={{ borderColor: `${hostAccent}66` }}
                    >
                      {parts ? (
                        <span
                          className="m-home-date"
                          style={{ borderColor: `${hostAccent}88`, color: hostAccent }}
                        >
                          <span className="m-home-date-day">{parts.day}</span>
                          <span className="m-home-date-month">{parts.month}</span>
                        </span>
                      ) : (
                        <span className="m-home-date">
                          <span className="m-home-date-month">Date</span>
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        {ev.host_name && (
                          <span
                            className="block text-[10px] uppercase tracking-[0.16em] mb-0.5"
                            style={{ color: hostAccent }}
                          >
                            {ev.host_name}
                          </span>
                        )}
                        <span className="block text-lg text-slate-100 leading-snug">{ev.title}</span>
                        <span className="block text-sm text-slate-400 mt-0.5">
                          {formatEventDateRange(ev.starts_at, ev.ends_at)}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
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
          <section className="m-home-about relative overflow-hidden rounded-[1.35rem] border border-slate-800">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImage} alt="" className="m-home-about-media" />
            ) : (
              <div
                className="m-home-about-media"
                style={{
                  background: `linear-gradient(145deg, ${accent}88 0%, ${accent}33 42%, rgb(15 23 42) 78%, rgb(2 6 23) 100%)`,
                }}
                aria-hidden
              />
            )}
            <div className="m-home-about-wash" aria-hidden />
            <div className="relative z-[1] p-6 sm:p-8 md:p-10 space-y-3 max-w-3xl">
              <p className="m-landing-eyebrow">À propos</p>
              <h2 className="text-3xl sm:text-4xl text-slate-50">{active.name}</h2>
              <p className="m-home-about-body text-sm sm:text-base whitespace-pre-wrap leading-relaxed">
                {active.description}
              </p>
              {(active.website || active.contact_email) && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {active.website && (
                    <a
                      href={
                        active.website.startsWith('http')
                          ? active.website
                          : `https://${active.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m-landing-btn"
                    >
                      Site web
                    </a>
                  )}
                  {active.contact_email && (
                    <a
                      href={`mailto:${active.contact_email}`}
                      className="m-landing-btn m-landing-btn--ghost"
                    >
                      {active.contact_email}
                    </a>
                  )}
                </div>
              )}
            </div>
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
