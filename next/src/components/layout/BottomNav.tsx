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
      className="md:hidden shrink-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]"
      aria-label="Navigation principale"
    >
      <div className="flex items-stretch justify-around px-1 pt-1">
        {MAIN_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] min-w-0 gap-0.5 rounded-lg px-0.5 py-1 text-[10px] leading-tight font-medium transition-colors ${
              page === item.id ? 'text-slate-100 font-semibold' : 'text-slate-400'
            }`}
          >
            <span className="text-lg relative shrink-0" aria-hidden>
              {item.icon}
              {item.id === 'messages' && clairiereUnread > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-violet-600 text-white text-[8px] font-bold px-0.5">
                  {clairiereUnread > 9 ? '9+' : clairiereUnread}
                </span>
              )}
            </span>
            <span className="w-full text-center whitespace-nowrap truncate">{item.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
