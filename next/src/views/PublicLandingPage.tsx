'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { useAuth } from '@/contexts/AuthContext'
import { ThemePicker } from '@/components/theme/ThemePicker'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'

const FEATURES = [
  {
    icon: '🧭',
    title: 'Un mur vivant',
    text: 'Carte, événements et messages des organisateurs réunis sur un même fil — par date ou par lieu.',
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

  const scrollToMur = useCallback(() => {
    document.getElementById('mur')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="h-full min-h-screen overflow-y-auto scroll-smooth bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a href="#top" className="font-bold text-lg tracking-tight shrink-0">
            Mandala
          </a>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            <a href="#mur" className="hover:text-slate-200 transition-colors">
              Mur &amp; carte
            </a>
            <a href="#projet" className="hover:text-slate-200 transition-colors">
              Le projet
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
                  className="text-sm px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 hidden sm:inline-flex"
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
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.45), transparent 70%)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-20 sm:pb-14">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-400/90 font-semibold mb-4">
                Réseau de lieux &amp; communautés
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.08]">
                Le mur vivant des lieux qui vous inspirent
              </h1>
              <p className="mt-5 text-lg text-slate-400 leading-relaxed max-w-2xl">
                Carte interactive, événements à venir et messages des organisateurs — tout ce qui
                anime les communautés Mandala, au même endroit.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToMur}
                  className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold transition-colors"
                >
                  Explorer le mur
                </button>
                <Link
                  href="/app"
                  className="px-6 py-3 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800/80 font-medium transition-colors text-center"
                >
                  {user ? 'Voir tout mon fil' : 'Rejoindre un lieu'}
                </Link>
              </div>
              {!loading && places.length > 0 && (
                <p className="mt-6 text-sm text-slate-500">
                  <span className="text-violet-300 font-semibold">{places.length}</span>{' '}
                  {places.length > 1 ? 'lieux actifs' : 'lieu actif'} · fil mis à jour en continu
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="mur" className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 scroll-mt-16">
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Mur &amp; carte</h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
              Parcourez le réseau géographiquement ou suivez l&apos;actualité. Connectez-vous pour
              débloquer les annonces complètes, le mur de vos lieux et les brèves des membres.
            </p>
          </div>
          <WallDiscoverSection mapHeightClass="h-[min(40vh,16rem)] sm:h-[min(56vh,30rem)]" feedLimit={20} />
        </section>

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

        <section className="border-t border-slate-800 bg-gradient-to-b from-violet-950/25 to-slate-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold">Vous gérez un lieu ?</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
              Publiez annonces et événements : ils apparaissent sur le mur de votre communauté et
              dans le fil public de Mandala.
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
