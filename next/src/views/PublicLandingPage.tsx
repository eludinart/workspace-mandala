'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { useAuth } from '@/contexts/AuthContext'
import { ThemePicker } from '@/components/theme/ThemePicker'
import { PlacePublicCard } from '@/components/public/PlacePublicCard'

const PlacesMap = dynamic(
  () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(60vh,32rem)] rounded-3xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

const FEATURES = [
  {
    icon: '🏛️',
    title: 'Promouvoir les lieux',
    text: "Chaque communauté présente son identité, sa localisation et ses moyens de contact au grand public.",
  },
  {
    icon: '👥',
    title: 'Vivre en communauté',
    text: 'Membres, calendrier, événements et échanges : un espace numérique au service du lien humain.',
  },
  {
    icon: '📜',
    title: 'Charte & engagement',
    text: "Chaque membre découvre et valide la charte du lieu avant d'intégrer l'espace communautaire.",
  },
]

export function PublicLandingPage() {
  const { user, loading: authLoading } = useAuth()
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

  const scrollToMap = useCallback(() => {
    document.getElementById('carte')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="h-full min-h-screen overflow-y-auto scroll-smooth bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a href="#top" className="font-bold text-lg tracking-tight shrink-0">
            Mandala
          </a>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            <a href="#carte" className="hover:text-slate-200 transition-colors">
              Carte
            </a>
            <a href="#projet" className="hover:text-slate-200 transition-colors">
              Le projet
            </a>
            <a href="#lieux" className="hover:text-slate-200 transition-colors">
              Lieux
            </a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <ThemePicker />
            {!authLoading && user ? (
              <Link
                href="/app"
                className="text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium"
              >
                Mon espace
              </Link>
            ) : (
              <>
                <Link
                  href="/app"
                  className="text-sm px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 hidden xs:inline-flex"
                >
                  Connexion
                </Link>
                <Link
                  href="/app"
                  className="text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium"
                >
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        {/* 1 — Présentation */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.45), transparent 70%)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-16 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-400/90 font-semibold mb-4">
              Réseau de lieux &amp; communautés
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1]">
              Des espaces de vie, de pratique et de rencontre
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Mandala relie des lieux et des communautés en France et dans l&apos;espace francophone.
              Découvrez les espaces inscrits, contactez-les pour vous renseigner, ou rejoignez une
              communauté en tant que membre.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={scrollToMap}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold transition-colors"
              >
                Explorer la carte
              </button>
              <Link
                href="/app"
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800/80 font-medium transition-colors"
              >
                {user ? 'Accéder à mon espace' : 'Créer un compte membre'}
              </Link>
            </div>
            {!loading && places.length > 0 && (
              <p className="mt-8 text-sm text-slate-500">
                <span className="text-violet-300 font-semibold">{places.length}</span>{' '}
                {places.length > 1 ? 'lieux référencés' : 'lieu référencé'} sur la plateforme
              </p>
            )}
          </div>
        </section>

        {/* 2 — Carte des lieux */}
        <section id="carte" className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 scroll-mt-16">
          <div className="mb-6 sm:mb-8 text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Carte des lieux</h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Visualisez l&apos;implantation géographique des communautés inscrites. Cliquez sur un
              marqueur pour voir le détail et accéder au profil du lieu.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-800 shadow-2xl shadow-black/40">
            <PlacesMap places={places} selectedSlug={selectedSlug} onSelect={selectPlaceOnMap} />
          </div>
        </section>

        {/* 3 — Blocs de présentation */}
        <section id="projet" className="border-y border-slate-800/60 bg-slate-900/30 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14 space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold">Une plateforme, trois promesses</h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Mandala met la technologie au service des lieux et de leurs communautés.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6 space-y-3 hover:border-violet-500/40 hover:bg-slate-900/40 transition-colors"
                >
                  <span
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-600/15 text-2xl"
                    aria-hidden
                  >
                    {f.icon}
                  </span>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4 — Les lieux inscrits */}
        <section id="lieux" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
          <div className="mb-8 sm:mb-10 text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Les lieux inscrits</h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Consultez les présentations et contactez directement les communautés qui vous
              intéressent.
            </p>
          </div>

          {loading && <p className="text-center text-sm text-slate-500">Chargement des lieux…</p>}

          {!loading && places.length === 0 && (
            <p className="text-sm text-slate-500 rounded-2xl border border-slate-800 p-8 text-center">
              Aucun lieu publié pour le moment.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {places.map((place) => (
              <PlacePublicCard
                key={place.slug}
                place={place}
                selected={selectedSlug === place.slug}
                onSelect={() => setSelectedSlug(place.slug)}
              />
            ))}
          </div>
        </section>

        {/* 5 — Appel gestionnaires */}
        <section className="border-t border-slate-800 bg-gradient-to-b from-violet-950/25 to-slate-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold">Vous gérez un lieu ?</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
              Organisateurs et gestionnaires : connectez-vous pour administrer votre communauté,
              publier des événements et accueillir de nouveaux membres.
            </p>
            <Link
              href="/app"
              className="inline-flex px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-600">
        <p>Mandala — lieux, communautés &amp; événements</p>
        <p className="mt-1">France · Belgique · Suisse · espace francophone</p>
      </footer>
    </div>
  )
}
