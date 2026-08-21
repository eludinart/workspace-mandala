'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { WallFeed } from '@/components/wall/WallFeed'
import { PlacePublicCard } from '@/components/public/PlacePublicCard'
import type { WallFeedSort } from '@/lib/wall-feed-types'

const PlacesMap = dynamic(
  () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(48vh,24rem)] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

export function WallDiscoverSection({
  mapHeightClass = 'h-[min(40vh,16rem)] sm:h-[min(52vh,28rem)]',
  feedLimit = 24,
  showPlacesList = true,
  onEventClick,
  initialSort = 'date',
}: {
  mapHeightClass?: string
  feedLimit?: number
  showPlacesList?: boolean
  onEventClick?: (eventId: number) => void
  initialSort?: WallFeedSort
}) {
  const [places, setPlaces] = useState<PublicCommunityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const loadPlaces = useCallback(async () => {
    setLoading(true)
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

  const selectPlace = useCallback((slug: string) => {
    setSelectedSlug(slug)
    document.getElementById(`mur-lieu-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-20">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Carte du réseau</h2>
            <p className="text-sm text-slate-400 mt-1">
              {loading
                ? 'Chargement…'
                : `${places.length} lieu${places.length > 1 ? 'x' : ''} — cliquez pour explorer`}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl shadow-black/30">
            <PlacesMap
              places={places}
              selectedSlug={selectedSlug}
              onSelect={selectPlace}
              heightClassName={mapHeightClass}
            />
          </div>
        </div>

        <div className="lg:col-span-3 min-w-0">
          <WallFeed
            initialSort={initialSort}
            limit={feedLimit}
            onEventClick={onEventClick}
          />
        </div>
      </div>

      {showPlacesList && places.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-800/80">
          <h2 className="text-lg font-semibold">Tous les lieux</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {places.map((place) => (
              <div key={place.slug} id={`mur-lieu-${place.slug}`}>
                <PlacePublicCard
                  place={place}
                  selected={selectedSlug === place.slug}
                  onSelect={() => setSelectedSlug(place.slug)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
