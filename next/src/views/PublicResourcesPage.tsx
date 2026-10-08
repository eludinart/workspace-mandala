'use client'

import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'
import { ResourceLibrary } from '@/components/resources/ResourceLibrary'
import { useAuth } from '@/contexts/AuthContext'

export function PublicResourcesPage() {
  const { user, loading: authLoading } = useAuth()

  return (
    <PublicSiteChrome user={user} authLoading={authLoading}>
      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <ResourceLibrary variant="public" />
        </section>
      </main>
    </PublicSiteChrome>
  )
}
