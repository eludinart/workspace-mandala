'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { skillsApi } from '@/api/skills'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import {
  EXPLORE_PROFILE_NUDGE_DISMISS_KEY,
  needsExploreProfileNudge,
} from '@/lib/skill-profile-visibility'
import { ACCOUNT_SKILLS_ANCHOR } from '@/components/skills/SkillsProfileSection'
import { CommunitySwitcher } from '@/components/layout/CommunitySwitcher'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'
import type { PublicCommunityCard } from '@/api/communities'

type Props = {
  onNavigate: MandalaNavigate
}

export function ExploreMandalaHome({ onNavigate }: Props) {
  const { joinCommunity } = useCommunity()
  const [joinOpen, setJoinOpen] = useState(false)
  const [showProfileNudge, setShowProfileNudge] = useState(false)
  const [joinBusySlug, setJoinBusySlug] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (typeof window !== 'undefined' && sessionStorage.getItem(EXPLORE_PROFILE_NUDGE_DISMISS_KEY) === '1') {
          if (!cancelled) setShowProfileNudge(false)
          return
        }
        const res = await skillsApi.getMine()
        if (cancelled) return
        setShowProfileNudge(needsExploreProfileNudge(res.profile))
      } catch {
        if (!cancelled) setShowProfileNudge(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dismissProfileNudge = useCallback(() => {
    try {
      sessionStorage.setItem(EXPLORE_PROFILE_NUDGE_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowProfileNudge(false)
  }, [])

  const goToSkills = useCallback(() => {
    try {
      sessionStorage.setItem(ACCOUNT_SKILLS_ANCHOR, 'competences')
    } catch {
      /* ignore */
    }
    onNavigate('account')
  }, [onNavigate])

  const handleJoinPlace = useCallback(
    async (place: PublicCommunityCard) => {
      setJoinError(null)
      if (place.join_mode === 'closed') {
        setJoinError(`« ${place.name} » n’accepte pas les adhésions libres.`)
        return
      }
      let inviteCode: string | null = null
      if (place.join_mode === 'invite') {
        inviteCode =
          typeof window !== 'undefined'
            ? window.prompt(`Code d’invitation pour « ${place.name} »`)
            : null
        if (inviteCode == null || !String(inviteCode).trim()) {
          setJoinError('Code d’invitation requis')
          return
        }
      }
      setJoinBusySlug(place.slug)
      try {
        await joinCommunity(place.slug, inviteCode)
      } catch (e: unknown) {
        setJoinError(e instanceof ApiError ? e.detail : 'Impossible de rejoindre ce lieu.')
      } finally {
        setJoinBusySlug(null)
      }
    },
    [joinCommunity]
  )

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
      <header className="space-y-2 pt-6 sm:pt-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Explorer Mandala</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50">Le réseau est déjà là</h1>
        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
          Carte, actualités et lieux publics — sans être rattaché·e à un lieu. Rejoindre un lieu ouvre
          ensuite le quotidien : mur du lieu, agenda, membres.
        </p>
      </header>

      <section className="space-y-3" aria-label="Prochaines étapes">
        <button
          type="button"
          onClick={() => setJoinOpen(true)}
          className="w-full text-left rounded-2xl border border-violet-500/40 bg-violet-950/30 px-4 py-4 hover:border-violet-400/70"
        >
          <p className="font-medium text-slate-100">Rejoindre un lieu</p>
          <p className="text-sm text-slate-400 mt-1">Charte, puis vie quotidienne avec la communauté.</p>
        </button>

        {showProfileNudge && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <p className="text-sm text-slate-300">
              Complétez votre fiche pour apparaître dans l’annuaire.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={goToSkills}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
              >
                Ma fiche
              </button>
              <button
                type="button"
                onClick={dismissProfileNudge}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                Plus tard
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate('directory')}
          className="text-sm text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
        >
          Parcourir l’annuaire
        </button>
      </section>

      {joinError && <p className="text-sm text-red-400">{joinError}</p>}
      {joinBusySlug && (
        <p className="text-sm text-slate-500">Adhésion à {joinBusySlug}…</p>
      )}

      <section className="space-y-3 pt-2 border-t border-slate-800/60">
        <div className="space-y-1">
          <p className="m-landing-eyebrow">Actualité</p>
          <h2 className="text-xl sm:text-2xl text-slate-100">Mur &amp; carte</h2>
        </div>
        <WallDiscoverSection
          feedLimit={16}
          showPlacesList
          showRelier={false}
          showJoin
          onJoinPlace={(place) => void handleJoinPlace(place)}
          joinBusySlug={joinBusySlug}
          mapHeightClass="h-[min(42vh,20rem)] md:h-[min(52vh,28rem)]"
        />
      </section>

      <CommunitySwitcher open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
