'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { useSocialStore } from '@/store/useSocialStore'
import { NotificationCenter } from '@/components/NotificationCenter'
import { ThemePicker } from '@/components/theme/ThemePicker'
import { ProfileMenu } from '@/components/layout/ProfileMenu'
import { ActivePlaceBar } from '@/components/layout/ActivePlaceBar'
import { PAGE_LABELS } from '@/lib/nav'

export function AppHeader({
  page,
  onNavigate,
  onOpenMenu,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
  onOpenMenu: () => void
}) {
  const clairiereUnread = useSocialStore((s) => s.clairiereUnreadCount)

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 min-h-[52px]">
        <button
          type="button"
          onClick={onOpenMenu}
          className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-800/80 shrink-0"
          aria-label="Ouvrir le menu"
        >
          <span className="flex flex-col gap-1 w-5" aria-hidden>
            <span className="block h-0.5 w-full rounded-full bg-slate-200" />
            <span className="block h-0.5 w-4 rounded-full bg-slate-200" />
            <span className="block h-0.5 w-full rounded-full bg-slate-200" />
          </span>
        </button>

        <div className="flex-1 min-w-0">
          {page === 'admin' ? (
            <div className="px-2 py-1.5 -ml-1 space-y-1">
              <ActivePlaceBar variant="header" />
              <h1 className="text-base sm:text-lg font-semibold truncate text-slate-100 pl-7 sm:pl-8">
                {PAGE_LABELS[page]}
              </h1>
            </div>
          ) : (
            <ActivePlaceBar page={page} variant="header" />
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <ThemePicker />
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
  )
}
