'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
import { publicApi } from '@/api/public'
import { useAuth } from '@/contexts/AuthContext'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'
import { LandingOffersSection } from '@/components/landing/LandingOffersSection'
import { LandingPromisesSection } from '@/components/landing/LandingPromisesSection'

const FEATURES = [
  {
    mark: '01',
    title: 'Un mur vivant',
    text: 'Carte, événements et messages des organisateurs réunis sur un même fil — par date ou par lieu.',
    href: '/#mur',
  },
  {
    mark: '02',
    title: 'Vivre ensemble',
    text: 'Membres, calendrier, événements et échanges : un espace numérique au service du lien humain.',
    href: '/competences',
  },
  {
    mark: '03',
    title: 'Charte & engagement',
    text: "Chaque membre découvre et valide la charte du lieu avant d'intégrer l'espace communautaire.",
    href: '/app',
  },
  {
    mark: '04',
    title: 'Des lieux inspirants',
    text: 'Ashrams, fermes, collectifs : chaque communauté cultive sa présence, à son rythme.',
    href: '/#lieux',
  },
]

export function PublicLandingPage() {
  const { user, loading: authLoading } = useAuth()
  const [places, setPlaces] = useState<PublicCommunityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [networkStats, setNetworkStats] = useState<{ places: number; people: number } | null>(
    null
  )

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

  useEffect(() => {
    let cancelled = false
    void publicApi
      .stats()
      .then((s) => {
        if (!cancelled) setNetworkStats({ places: s.places ?? 0, people: s.people ?? 0 })
      })
      .catch(() => {
        if (!cancelled) setNetworkStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const scrollToMur = useCallback(() => {
    document.getElementById('mur')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <PublicSiteChrome user={user} authLoading={authLoading}>
      <main>
        <section id="top" className="m-landing-hero">
          <div className="m-landing-hero-inner">
            <span className="m-landing-brand-mark" aria-hidden>
              ॐ
            </span>
            <span className="m-landing-logo">Mandala</span>
            <p className="m-landing-eyebrow mb-5">
              Des lieux, une communauté, des professionnels à portée de main.
            </p>
            <h1 className="m-landing-hero-title">
              Le mur vivant des communautés
              <br />
              qui vous inspirent,
              <br />
              et de ceux qui les font vivre.
            </h1>
            <p className="m-landing-hero-lede">
              Carte interactive, événements à venir, messages des organisateurs et annuaire de
              compétences — pros et amateurs — tout ce qui anime les communautés Mandala, au même
              endroit.
            </p>
            <div className="m-landing-hero-actions">
              <button type="button" onClick={scrollToMur} className="m-landing-btn">
                Explorer le mur
              </button>
              <Link href="/competences" className="m-landing-btn m-landing-btn--ghost">
                Annuaire
              </Link>
              <Link
                href={user ? '/app' : '/app?mode=register'}
                className="m-landing-btn m-landing-btn--ghost"
              >
                {user ? 'Ouvrir mon profil' : 'Rejoindre un lieu'}
              </Link>
            </div>
            {networkStats && (networkStats.places > 0 || networkStats.people > 0) && (
              <p className="m-landing-hero-meta" aria-live="polite">
                <span className="text-[rgb(var(--accent-400))] font-semibold">
                  {networkStats.places}
                </span>{' '}
                {networkStats.places > 1 ? 'lieux' : 'lieu'}
                <span className="mx-2 text-slate-600" aria-hidden>
                  ·
                </span>
                <span className="text-[rgb(var(--accent-400))] font-semibold">
                  {networkStats.people}
                </span>{' '}
                {networkStats.people > 1 ? 'personnes' : 'personne'}
                <span className="ml-2 text-slate-500">sur le réseau</span>
              </p>
            )}
            {!networkStats && !loading && places.length > 0 && (
              <p className="m-landing-hero-meta">
                <span className="text-[rgb(var(--accent-400))] font-semibold">{places.length}</span>{' '}
                {places.length > 1 ? 'lieux actifs' : 'lieu actif'} · fil mis à jour en continu
              </p>
            )}
          </div>
        </section>

        <section className="m-landing-features" aria-label="Ce que propose Mandala">
          <div className="m-landing-features-grid">
            {FEATURES.map((f) => (
              <Link key={f.title} href={f.href} className="m-landing-icon-card">
                <div className="m-landing-icon-mark" aria-hidden>
                  {f.mark}
                </div>
                <h3 className="text-xl mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.text}</p>
              </Link>
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
          <WallDiscoverSection feedLimit={20} />
        </section>

        <LandingPromisesSection />

        <LandingOffersSection />

        <section id="rejoindre" className="m-landing-cta-band scroll-mt-16">
          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <p className="m-landing-eyebrow !text-[rgb(var(--accent-300))]">Rejoindre</p>
            <h2 className="text-3xl sm:text-4xl text-slate-50">Vous gérez un lieu ?</h2>
            <p className="text-slate-200/85 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
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
        <p className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-slate-400">
          <Link href="/cgu" className="hover:text-[rgb(var(--accent-400))]">
            CGU
          </Link>
          <Link href="/cgv" className="hover:text-[rgb(var(--accent-400))]">
            CGV
          </Link>
          <Link href="/confidentialite" className="hover:text-[rgb(var(--accent-400))]">
            Confidentialité
          </Link>
        </p>
      </footer>
    </PublicSiteChrome>
  )
}
