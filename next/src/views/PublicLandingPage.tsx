'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { useAuth } from '@/contexts/AuthContext'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'
import { SkillsDirectory } from '@/components/skills/SkillsDirectory'
import { ResourceLibrary } from '@/components/resources/ResourceLibrary'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'

const FEATURES = [
  {
    icon: '🧭',
    title: 'Un mur vivant',
    text: 'Carte, événements et messages des organisateurs réunis sur un même fil — par date ou par lieu.',
  },
  {
    icon: '👥',
    title: 'Vivre ensemble',
    text: 'Membres, calendrier, événements et échanges : un espace numérique au service du lien humain.',
  },
  {
    icon: '📜',
    title: 'Charte & engagement',
    text: "Chaque membre découvre et valide la charte du lieu avant d'intégrer l'espace communautaire.",
  },
  {
    icon: '🌿',
    title: 'Des lieux inspirants',
    text: 'Ashrams, fermes, collectifs : chaque communauté cultive sa présence, à son rythme.',
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
    <PublicSiteChrome user={user} authLoading={authLoading}>
      <main>
        <section id="top" className="m-landing-hero">
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
            <p className="m-landing-eyebrow mb-5">Réseau de lieux &amp; communautés</p>
            <h1 className="m-landing-hero-title">
              Le mur vivant des lieux
              <br />
              qui vous inspirent
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Carte interactive, événements à venir et messages des organisateurs — tout ce qui
              anime les communautés Mandala, au même endroit.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button type="button" onClick={scrollToMur} className="m-landing-btn">
                Explorer le mur
              </button>
              <Link
                href={user ? '/app' : '/app?mode=register'}
                className="m-landing-btn m-landing-btn--ghost"
              >
                {user ? 'Voir tout mon fil' : 'Rejoindre un lieu'}
              </Link>
            </div>
            {!loading && places.length > 0 && (
              <p className="mt-7 text-sm text-slate-500">
                <span className="text-violet-300 font-semibold">{places.length}</span>{' '}
                {places.length > 1 ? 'lieux actifs' : 'lieu actif'} · fil mis à jour en continu
              </p>
            )}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-6 sm:pb-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {FEATURES.map((f) => (
              <article key={f.title} className="m-landing-icon-card">
                <div className="m-landing-icon-mark" aria-hidden>
                  {f.icon}
                </div>
                <h3 className="text-xl mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="mur" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-16">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <p className="m-landing-eyebrow">Actualité</p>
            <h2 className="text-3xl sm:text-4xl">Mur &amp; carte</h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Parcourez le réseau géographiquement ou suivez l&apos;actualité. Connectez-vous pour
              débloquer les annonces complètes, le mur de vos lieux et les brèves des membres.
            </p>
          </div>
          <WallDiscoverSection mapHeightClass="h-[min(40vh,16rem)] sm:h-[min(56vh,30rem)]" feedLimit={20} />
        </section>

        <section id="competences" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-16">
          <SkillsDirectory variant="public" />
        </section>

        <section id="ressources" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-16">
          <ResourceLibrary variant="public" />
        </section>

        <section id="projet" className="scroll-mt-16 py-16 sm:py-20 bg-slate-900/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-4">
            <p className="m-landing-eyebrow">Le projet</p>
            <h2 className="text-3xl sm:text-4xl">Une plateforme, trois promesses</h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Mandala met la technologie au service des lieux et de leurs communautés : présence,
              calendrier, et un mur vivant pour relier les uns aux autres.
            </p>
          </div>
        </section>

        <section
          id="rejoindre"
          className="relative overflow-hidden py-16 sm:py-20"
          style={{
            background:
              'linear-gradient(180deg, rgb(var(--accent-700) / 0.35), rgb(var(--slate-950)))',
          }}
        >
          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <p className="m-landing-eyebrow">Rejoindre</p>
            <h2 className="text-3xl sm:text-4xl">Vous gérez un lieu ?</h2>
            <p className="text-slate-300/90 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Publiez annonces et événements : ils apparaissent sur le mur de votre communauté et
              dans le fil public de Mandala.
            </p>
            <Link href="/app" className="m-landing-btn">
              Se connecter
            </Link>
          </div>
        </section>
      </main>

      <footer className="m-landing-footer py-10 text-center text-xs text-slate-500">
        <p className="m-landing-logo text-[11px] tracking-[0.35em] text-slate-400 mb-3">Mandala</p>
        <p>Lieux, communautés &amp; événements</p>
        <p className="mt-1">France · Belgique · Suisse · espace francophone</p>
      </footer>
    </PublicSiteChrome>
  )
}
