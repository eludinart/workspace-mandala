'use client'

import { useState } from 'react'
import { SkillsCarousel } from '@/components/landing/SkillsCarousel'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'
import { SkillsDirectory } from '@/components/skills/SkillsDirectory'
import { useAuth } from '@/contexts/AuthContext'

export function PublicSkillsPage() {
  const { user, loading: authLoading } = useAuth()
  const [highlightUserId, setHighlightUserId] = useState<number | null>(null)

  return (
    <PublicSiteChrome user={user} authLoading={authLoading}>
      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold text-slate-50">
              Compétences du réseau
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Pas un annuaire froid type Google ou Facebook : ici les pratiques sont
              ancrées dans des lieux qui se font confiance. Les Mandala Pro portent un
              badge endossé par une communauté — pas seulement une carte bancaire.
            </p>
          </div>
          <SkillsCarousel
            onOpenProfile={(userId) => {
              setHighlightUserId(userId)
              document.getElementById('annuaire')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
          <div id="annuaire" className="scroll-mt-20">
            <SkillsDirectory variant="public" initialUserId={highlightUserId} />
          </div>
        </section>
      </main>
    </PublicSiteChrome>
  )
}
