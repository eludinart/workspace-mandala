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
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
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
