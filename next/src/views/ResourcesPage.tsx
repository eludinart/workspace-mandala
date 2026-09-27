'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'
import { ResourceLibrary } from '@/components/resources/ResourceLibrary'
import { useCommunity } from '@/contexts/CommunityContext'

export function ResourcesPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { active } = useCommunity()
  void onNavigate
  return (
    <div className="w-full">
      <ResourceLibrary communitySlug={active?.slug} communityName={active?.name} />
    </div>
  )
}
