'use client'

import { useState } from 'react'
import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { useSocialStore } from '@/store/useSocialStore'
import { NotificationCenter } from '@/components/NotificationCenter'
import { ProfileMenu } from '@/components/layout/ProfileMenu'
import { CommunitySwitcher } from '@/components/layout/CommunitySwitcher'
import { PAGE_LABELS } from '@/lib/nav'
import { CommunityAvatar } from '@/components/CommunityAvatar'

export function AppHeader({
  page,
  onNavigate,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
}) {
  const { active } = useCommunity()
  const [communityOpen, setCommunityOpen] = useState(false)
  const clairiereUnread = useSocialStore((s) => s.clairiereUnreadCount)
  const accent = active?.accent_color ?? '#7c3aed'

  return (
    <>
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4 min-h-[52px]">
          {page === 'admin' ? (
            <div className="flex-1 min-w-0 px-2 py-1.5 -ml-1">
              <h1 className="text-base sm:text-lg font-semibold truncate text-slate-100">
                {PAGE_LABELS[page]}
              </h1>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCommunityOpen(true)}
              className="flex-1 min-w-0 text-left rounded-xl hover:bg-slate-900/80 px-2 py-1.5 -ml-1 transition-colors"
              aria-label="Changer de communauté"
            >
              <p className="text-[10px] uppercase tracking-widest text-slate-500 truncate flex items-center gap-1.5">
                {active && (
                  <CommunityAvatar
                    avatar={active.avatar}
                    logoEmoji={active.logo_emoji}
                    accentColor={active.accent_color}
                    size="xs"
                    className="!w-5 !h-5 !text-sm"
                  />
                )}
                <span className="truncate">{active?.name ?? 'Communauté'}</span>
                <span className="text-slate-600 shrink-0">▾</span>
              </p>
              <h1 className="text-base sm:text-lg font-semibold truncate" style={{ color: accent }}>
                {PAGE_LABELS[page]}
              </h1>
            </button>
          )}

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('messages')}
              className="relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-800/80 md:hidden"
              aria-label={`Messages${clairiereUnread ? ` (${clairiereUnread})` : ''}`}
            >
              <span className="text-xl">💬</span>
              {clairiereUnread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-violet-600 text-white text-[9px] font-bold px-0.5">
                  {clairiereUnread > 99 ? '99+' : clairiereUnread}
                </span>
              )}
            </button>
            <NotificationCenter onNavigate={onNavigate} />
            <ProfileMenu onNavigate={onNavigate} />
          </div>
        </div>
      </header>
      <CommunitySwitcher open={communityOpen} onClose={() => setCommunityOpen(false)} />
    </>
  )
}
