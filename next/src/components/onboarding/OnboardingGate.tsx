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
    async (slug: string) => {
      await joinCommunity(slug)
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950 relative">
      <div className="absolute top-3 right-3 z-10">
        <ThemePicker />
      </div>

      {phase === 'loading' && (
        <p className="text-sm text-slate-400">Préparation de votre espace…</p>
      )}

      {phase === 'place' && (
        <PlaceSelectionScreen
          title="Rejoignez un lieu"
          subtitle="Choisissez le lieu sur lequel vous souhaitez vous inscrire. Vous pourrez en rejoindre d'autres plus tard."
          onComplete={handlePlaceJoined}
        />
      )}

      {phase === 'charter' && charterSlug && (
        <CharterAcceptanceScreen slug={charterSlug} onAccepted={handleCharterAccepted} />
      )}
    </div>
  )
}
