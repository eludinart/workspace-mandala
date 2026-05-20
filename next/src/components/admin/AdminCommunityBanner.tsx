'use client'

import { useState } from 'react'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { CommunitySwitcher } from '@/components/layout/CommunitySwitcher'
import { useCommunity } from '@/contexts/CommunityContext'

/** Contexte communauté en tête de la page Admin (au-dessus du titre « Administration »). */
export function AdminCommunityBanner() {
  const { active } = useCommunity()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const accent = active?.accent_color ?? '#7c3aed'

  if (!active) return null

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 pb-3 mb-1 border-b border-slate-800/80">
        <CommunityAvatar
          avatar={active.avatar}
          logoEmoji={active.logo_emoji}
          accentColor={active.accent_color}
          size="md"
          alt={active.name}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Espace administré</p>
          <p className="text-xl font-bold truncate" style={{ color: accent }}>
            {active.name}
          </p>
          {active.tagline && (
            <p className="text-sm text-slate-400 truncate mt-0.5">{active.tagline}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-900"
        >
          Changer ▾
        </button>
      </div>
      <CommunitySwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </>
  )
}
