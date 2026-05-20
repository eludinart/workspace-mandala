'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { MAIN_NAV } from '@/lib/nav'
import { useSocialStore } from '@/store/useSocialStore'

export function BottomNav({
  page,
  onNavigate,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
}) {
  const clairiereUnread = useSocialStore((s) => s.clairiereUnreadCount)

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md safe-area-pb"
      aria-label="Navigation principale"
    >
      <div className="flex items-stretch justify-around px-1 py-1">
        {MAIN_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center flex-1 min-h-[52px] gap-0.5 rounded-lg text-[10px] font-medium transition-colors ${
              page === item.id ? 'text-violet-300' : 'text-slate-500'
            }`}
          >
            <span className="text-lg relative" aria-hidden>
              {item.icon}
              {item.id === 'messages' && clairiereUnread > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-violet-600 text-white text-[8px] font-bold px-0.5">
                  {clairiereUnread > 9 ? '9+' : clairiereUnread}
                </span>
              )}
            </span>
            <span>{item.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
