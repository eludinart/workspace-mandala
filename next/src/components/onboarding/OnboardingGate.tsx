'use client'

import { useCallback, useEffect, useState } from 'react'
import { communitiesApi } from '@/api/communities'
import { useCommunity } from '@/contexts/CommunityContext'
import { ThemePicker } from '@/components/theme/ThemePicker'
import { PlaceSelectionScreen } from '@/components/onboarding/PlaceSelectionScreen'
import { CharterAcceptanceScreen } from '@/components/onboarding/CharterAcceptanceScreen'

type GatePhase = 'loading' | 'place' | 'charter' | 'ready'

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { communities, loading: communitiesLoading, joinCommunity, setActiveSlug, active } =
    useCommunity()
  const [phase, setPhase] = useState<GatePhase>('loading')
  const [pendingCharterSlugs, setPendingCharterSlugs] = useState<string[]>([])
  const [charterSlug, setCharterSlug] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    if (communitiesLoading) return
    if (communities.length === 0) {
      setPhase('place')
      return
    }
    try {
      const status = await communitiesApi.onboardingStatus()
      const pending = status.pending_charter_slugs ?? []
      setPendingCharterSlugs(pending)
      if (pending.length > 0) {
        const pick =
          (active?.slug && pending.includes(active.slug) ? active.slug : null) ?? pending[0]
        setCharterSlug(pick)
        setPhase('charter')
        return
      }
      setPhase('ready')
    } catch {
      setPhase('ready')
    }
  }, [active?.slug, communities.length, communitiesLoading])

  useEffect(() => {
    if (communitiesLoading) {
      setPhase('loading')
      return
    }
    void refreshStatus()
  }, [communitiesLoading, refreshStatus, active?.slug])

  const handlePlaceJoined = useCallback(
    async (slug: string, inviteCode?: string | null) => {
      await joinCommunity(slug, inviteCode)
      setActiveSlug(slug)
      try {
        sessionStorage.removeItem('mdl_post_register_onboarding')
      } catch {
        /* ignore */
      }
      const status = await communitiesApi.onboardingStatus()
      const pending = status.pending_charter_slugs ?? []
      setPendingCharterSlugs(pending)
      if (pending.length > 0) {
        setCharterSlug(pending.includes(slug) ? slug : pending[0])
        setPhase('charter')
      } else {
        setPhase('ready')
      }
    },
    [joinCommunity, setActiveSlug]
  )

  const handleCharterAccepted = useCallback(() => {
    const remaining = pendingCharterSlugs.filter((s) => s !== charterSlug)
    setPendingCharterSlugs(remaining)
    if (remaining.length > 0) {
      setCharterSlug(remaining[0])
      return
    }
    setCharterSlug(null)
    setPhase('ready')
  }, [charterSlug, pendingCharterSlugs])

  if (phase === 'ready') {
    return <>{children}</>
  }

  return (
    <div className="relative flex-1 h-full min-h-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950">
      <div className="absolute top-3 right-3 z-10">
        <ThemePicker />
      </div>

      {phase === 'loading' && (
        <div className="flex-1 min-h-0 flex items-center justify-center px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          <p className="text-sm text-slate-400">Préparation de votre espace…</p>
        </div>
      )}

      {phase === 'place' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
            <PlaceSelectionScreen
              title="Rejoignez un lieu"
              subtitle="Choisissez le lieu sur lequel vous souhaitez vous inscrire. Vous pourrez en rejoindre d'autres plus tard."
              onComplete={handlePlaceJoined}
            />
          </div>
        </div>
      )}

      {phase === 'charter' && charterSlug && (
        <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-6">
          <CharterAcceptanceScreen slug={charterSlug} onAccepted={handleCharterAccepted} />
        </div>
      )}
    </div>
  )
}
