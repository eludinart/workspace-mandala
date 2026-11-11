'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { placeLinksApi } from '@/api/place-links'
import { WallFeed } from '@/components/wall/WallFeed'
import { PlacesCarousel } from '@/components/landing/PlacesCarousel'
import type { WallFeedSort } from '@/lib/wall-feed-types'

const PlacesMap = dynamic(
  () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(48vh,22rem)] md:h-[min(58vh,34rem)] rounded-[1.35rem] border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

/** Largeur du cadre contenu (comme la photo hero) — carte pleine largeur. */
const DEFAULT_MAP_HEIGHT =
  'h-[min(48vh,22rem)] md:h-[min(58vh,34rem)] lg:h-[min(62vh,38rem)]'

export function WallDiscoverSection({
  mapHeightClass = DEFAULT_MAP_HEIGHT,
  feedLimit = 24,
  showFeed = true,
  showPlacesList = true,
  showRelier = true,
  showJoin = false,
  onJoinPlace,
  joinBusySlug = null,
  onEventClick,
  onOpenProfile,
  initialSort = 'date',
  /** Pages qui déclenchent un soft-refresh lieux (pull-to-refresh). */
  pullRefreshPages = ['places-map'],
  compactHeader = false,
}: {
  mapHeightClass?: string
  feedLimit?: number
  /** Mur d’actu sous la carte (Découvrir). Désactiver pour ne garder que carte + lieux. */
  showFeed?: boolean
  showPlacesList?: boolean
  showRelier?: boolean
  showJoin?: boolean
  onJoinPlace?: (place: PublicCommunityCard) => void
  joinBusySlug?: string | null
  onEventClick?: (eventId: number) => void
  onOpenProfile?: (userId: number) => void
  initialSort?: WallFeedSort
  pullRefreshPages?: readonly string[]
  /** Titres plus discrets (ex. onglet Annuaire). */
  compactHeader?: boolean
}) {
  const pullRefreshKey = pullRefreshPages.join('|')
  const [places, setPlaces] = useState<PublicCommunityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [friendIds, setFriendIds] = useState<number[]>([])
  const [mapFullscreen, setMapFullscreen] = useState(false)

  const loadPlaces = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false
    if (!soft) setLoading(true)
    try {
      const res = await communitiesApi.publicList()
      setPlaces(res.items ?? [])
    } catch {
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPlaces()
  }, [loadPlaces])

  useEffect(() => {
    if (!pullRefreshKey) return
    const allowed = new Set(pullRefreshKey.split('|').filter(Boolean))
    const onPull = (ev: Event) => {
      const page = (ev as CustomEvent<{ page?: string }>).detail?.page
      if (!page || !allowed.has(page)) return
      void loadPlaces({ soft: true })
    }
    window.addEventListener('mandala-pull-refresh', onPull)
    return () => window.removeEventListener('mandala-pull-refresh', onPull)
  }, [loadPlaces, pullRefreshKey])

  useEffect(() => {
    if (!selectedSlug) {
      setFriendIds([])
      return
    }
    const place = places.find((p) => p.slug === selectedSlug)
    if (!place?.id) {
      setFriendIds([])
      return
    }
    setFriendIds([])
    let cancelled = false
    void placeLinksApi
      .friendsOf(place.id)
      .then((res) => {
        if (!cancelled) setFriendIds(res.can_view ? res.friend_ids ?? [] : [])
      })
      .catch(() => {
        if (!cancelled) setFriendIds([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedSlug, places])

  useEffect(() => {
    if (!mapFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mapFullscreen])

  const selectPlaceOnMap = useCallback((slug: string) => {
    setSelectedSlug(slug || null)
  }, [])

  return (
    <div className={compactHeader ? 'space-y-6' : 'space-y-10'}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {!compactHeader && <p className="m-landing-eyebrow mb-2">Carte</p>}
            <h2
              className={
                compactHeader
                  ? 'text-lg sm:text-xl font-semibold text-slate-100'
                  : 'text-2xl sm:text-3xl text-slate-100'
              }
            >
              Le réseau
            </h2>
            <p className={`text-sm text-slate-400 ${compactHeader ? 'mt-1' : 'mt-2'}`}>
              {loading
                ? 'Chargement…'
                : `${places.length} lieu${places.length > 1 ? 'x' : ''} — cliquez pour explorer · liens entre lieux amis`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMapFullscreen(true)}
            className="md:hidden text-sm px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-950/40 text-violet-100 hover:bg-violet-900/40"
          >
            Explorer en plein écran
          </button>
          <button
            type="button"
            onClick={() => setMapFullscreen(true)}
            className="hidden md:inline-flex text-sm px-3 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800/80"
          >
            Agrandir la carte
          </button>
        </div>
        <div
          className={`overflow-hidden rounded-[1.35rem] border border-slate-800 shadow-xl shadow-black/20 ${
            mapFullscreen ? 'invisible h-0 border-0 shadow-none overflow-hidden' : ''
          }`}
        >
          {!mapFullscreen && (
            <PlacesMap
              places={places}
              selectedSlug={selectedSlug}
              friendCommunityIds={friendIds}
              onSelect={selectPlaceOnMap}
              heightClassName={mapHeightClass}
              sizeToken="inline"
              frameClassName="rounded-[1.35rem]"
            />
          )}
        </div>
      </section>

      {showFeed && (
        <section className="min-w-0 pt-2 border-t border-slate-800/60">
          <WallFeed
            initialSort={initialSort}
            limit={feedLimit}
            onEventClick={onEventClick}
            onOpenProfile={onOpenProfile}
          />
        </section>
      )}

      {showPlacesList && places.length > 0 && (
        <section id="lieux" className="space-y-5 pt-6 border-t border-slate-800/70 scroll-mt-16">
          <div className="text-center sm:text-left space-y-2">
            {!compactHeader && <p className="m-landing-eyebrow">Communautés</p>}
            <h2 className={compactHeader ? 'text-lg sm:text-xl font-semibold' : 'text-2xl sm:text-3xl'}>
              Tous les lieux
            </h2>
            <p className="text-sm text-slate-500">
              Glissez horizontalement pour parcourir les lieux.
            </p>
          </div>
          <PlacesCarousel
            places={places}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
            showRelier={showRelier}
            showJoin={showJoin}
            onJoinPlace={onJoinPlace}
            joinBusySlug={joinBusySlug}
          />
        </section>
      )}

      {mapFullscreen && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Carte des lieux en grand"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-800 bg-slate-950/95">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">Le réseau</p>
              <p className="text-[11px] text-slate-500 truncate">
                {places.length} lieu{places.length > 1 ? 'x' : ''} — liens entre lieux amis
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMapFullscreen(false)}
              className="shrink-0 text-sm px-3 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
            >
              Fermer
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <PlacesMap
              places={places}
              selectedSlug={selectedSlug}
              friendCommunityIds={friendIds}
              onSelect={selectPlaceOnMap}
              heightClassName="h-full min-h-[70vh]"
              sizeToken="fullscreen"
              frameClassName="rounded-none border-0 h-full shadow-none"
              hideCaption
            />
          </div>
        </div>
      )}
    </div>
  )
}
