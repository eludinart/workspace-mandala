'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const count = places.length

  const scrollToIndex = useCallback((i: number, behavior: ScrollBehavior = 'smooth') => {
    const root = scrollerRef.current
    if (!root) return
    const card = root.querySelector<HTMLElement>(`[data-place-rail-index="${i}"]`)
    if (!card) return
    const left = card.offsetLeft - (root.clientWidth - card.clientWidth) / 2
    root.scrollTo({ left: Math.max(0, left), behavior })
  }, [])

  useEffect(() => {
    if (!selectedSlug) return
    const i = places.findIndex((p) => p.slug === selectedSlug)
    if (i < 0) return
    setActiveIndex(i)
    scrollToIndex(i)
  }, [selectedSlug, places, scrollToIndex])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root || count < 1) return

    const updateActive = () => {
      const mid = root.scrollLeft + root.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      root.querySelectorAll<HTMLElement>('[data-place-rail-index]').forEach((el) => {
        const i = Number(el.dataset.placeRailIndex)
        const center = el.offsetLeft + el.clientWidth / 2
        const dist = Math.abs(center - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      setActiveIndex(best)
    }

    updateActive()
    root.addEventListener('scroll', updateActive, { passive: true })
    return () => root.removeEventListener('scroll', updateActive)
  }, [count, places])

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return
      const next = (activeIndex + delta + count) % count
      setActiveIndex(next)
      scrollToIndex(next)
      const slug = places[next]?.slug
      if (slug) onSelect?.(slug)
    },
    [activeIndex, count, onSelect, places, scrollToIndex]
  )

  if (count === 0) return null

  return (
    <div
      className="m-place-rail space-y-3"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Lieux du réseau Mandala"
    >
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-xs text-slate-500">
          {activeIndex + 1} / {count}
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

      <div ref={scrollerRef} className="m-place-rail-scroller">
        {places.map((p, i) => (
          <div
            key={p.slug}
            id={`mur-lieu-${p.slug}`}
            data-place-rail-index={i}
            className="m-place-rail-slide"
          >
            <PlacePublicCard
              place={p}
              selected={selectedSlug === p.slug || activeIndex === i}
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

      {count > 1 && count <= 12 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Choisir un lieu">
          {places.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={p.name}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex
                  ? 'w-6 bg-[rgb(var(--accent-400))]'
                  : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
              onClick={() => {
                setActiveIndex(i)
                scrollToIndex(i)
                onSelect?.(p.slug)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
