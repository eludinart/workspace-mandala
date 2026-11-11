'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PublicCommunityCard } from '@/api/communities'
import { PlacePublicCard } from '@/components/public/PlacePublicCard'

type Props = {
  places: PublicCommunityCard[]
  selectedSlug?: string | null
  onSelect?: (slug: string) => void
  showRelier?: boolean
  showJoin?: boolean
  onJoinPlace?: (place: PublicCommunityCard) => void
  joinBusySlug?: string | null
}

export function PlacesCarousel({
  places,
  selectedSlug,
  onSelect,
  showRelier = false,
  showJoin = false,
  onJoinPlace,
  joinBusySlug = null,
}: Props) {
  const [index, setIndex] = useState(0)
  const count = places.length

  useEffect(() => {
    if (index < count) return
    setIndex(0)
  }, [index, count])

  useEffect(() => {
    if (!selectedSlug) return
    const i = places.findIndex((p) => p.slug === selectedSlug)
    if (i >= 0) setIndex(i)
  }, [selectedSlug, places])

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return
      setIndex((prev) => (prev + delta + count) % count)
    },
    [count]
  )

  if (count === 0) return null

  const place = places[index]
  if (!place) return null

  return (
    <div
      className="space-y-4"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Lieux du réseau Mandala"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {index + 1} / {count}
        </p>
        {count > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="m-skills-carousel-nav"
              aria-label="Lieu précédent"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="m-skills-carousel-nav"
              aria-label="Lieu suivant"
              onClick={() => go(1)}
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden">
        <div
          className="m-skills-carousel-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {places.map((p) => (
            <div
              key={p.slug}
              id={`mur-lieu-${p.slug}`}
              className="w-full shrink-0 px-0.5"
              aria-hidden={p.slug !== place.slug}
            >
              <PlacePublicCard
                place={p}
                selected={selectedSlug === p.slug}
                onSelect={() => onSelect?.(p.slug)}
                showRelier={showRelier}
                showJoin={showJoin}
                onJoin={onJoinPlace ? () => onJoinPlace(p) : undefined}
                joinBusy={joinBusySlug === p.slug}
                compact
              />
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Choisir un lieu">
          {places.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={p.name}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? 'w-6 bg-[rgb(var(--accent-400))]'
                  : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
