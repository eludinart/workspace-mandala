'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { PlacePublicCard } from '@/components/public/PlacePublicCard'

const PlacesMap = dynamic(
  () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(40vh,16rem)] sm:h-[min(52vh,28rem)] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

/**
 * Carte des lieux accessible depuis l'espace connecté (`/app`).
 * Navigation interne : indépendante du protocole de la page publique `/`.
 */
export function PlacesMapPage() {
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

  const selectPlaceOnMap = useCallback((slug: string) => {
    setSelectedSlug(slug)
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Carte des lieux</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Visualisez l&apos;implantation géographique des lieux inscrits. Cliquez sur un marqueur
            pour afficher le détail et accéder au profil du lieu.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-3 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800/80 whitespace-nowrap"
        >
          🌐 Voir le site public
        </a>
      </header>

      {!loading && (
        <p className="text-sm text-slate-500">
          <span className="text-violet-300 font-semibold">{places.length}</span>{' '}
          {places.length > 1 ? 'lieux référencés' : 'lieu référencé'}
        </p>
      )}

      <PlacesMap places={places} selectedSlug={selectedSlug} onSelect={selectPlaceOnMap} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Les lieux inscrits</h2>

        {loading && <p className="text-sm text-slate-500">Chargement des lieux…</p>}

        {!loading && places.length === 0 && (
          <p className="text-sm text-slate-500 rounded-xl border border-slate-800 p-6 text-center">
            Aucun lieu publié pour le moment.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {places.map((place) => (
            <div key={place.slug} id={`carte-lieu-${place.slug}`}>
              <PlacePublicCard
                place={place}
                selected={selectedSlug === place.slug}
                onSelect={() => setSelectedSlug(place.slug)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
