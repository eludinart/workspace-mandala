'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import type { AdminTabId } from '@/lib/nav'
import { useAuth } from '@/contexts/AuthContext'
import { socialApi } from '@/api/social'
import { useSocialStore } from '@/store/useSocialStore'
import { AppHeader } from '@/components/layout/AppHeader'
import { PlaceSwitchBanner } from '@/components/layout/PlaceSwitchBanner'
import { AdminActingRoleBar } from '@/components/AdminActingRoleBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AppNavPanel } from '@/components/layout/AppNavPanel'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'
import { PushNotificationPriming } from '@/components/PushNotificationPriming'
import { HelpButton } from '@/components/help/HelpButton'
import { useEffect, useState } from 'react'

export function Layout({
  page,
  onNavigate,
  adminTab,
  onBack,
  children,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
  adminTab?: AdminTabId
  onBack?: () => void
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const fetchClairiereUnread = useSocialStore((s) => s.fetchClairiereUnread)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    void socialApi.presenceHeartbeat().catch(() => {})
    void fetchClairiereUnread()
    const t = setInterval(() => {
      void socialApi.presenceHeartbeat().catch(() => {})
      void fetchClairiereUnread()
    }, 120000)
    return () => clearInterval(t)
  }, [user, fetchClairiereUnread])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [page])

  if (page === 'messages') {
    return (
      <div className="h-full min-h-0 flex flex-col bg-slate-950 text-slate-100">
        <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">{children}</main>
        <HelpButton page={page} />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col md:flex-row bg-slate-950 text-slate-100">
      <aside className="hidden md:flex md:w-56 lg:w-60 border-r border-slate-800 shrink-0 self-stretch">
        <div className="w-full p-3 flex flex-col min-h-0 sticky top-0 max-h-full">
          <AppNavPanel page={page} onNavigate={onNavigate} adminTab={adminTab} />
        </div>
      </aside>

      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <AppHeader
          page={page}
          onNavigate={onNavigate}
          onOpenMenu={() => setMobileNavOpen(true)}
          onBack={onBack}
        />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden shrink-0 flex items-center gap-1 px-3 min-h-[44px] text-sm font-medium text-violet-300 hover:bg-slate-800/40 border-b border-slate-800"
            aria-label="Page précédente"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 5.5 8.5 12l6.5 6.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Retour
          </button>
        )}
        <PlaceSwitchBanner />
        <AdminActingRoleBar />
        <PushNotificationPriming />
        <main
          className={`flex-1 min-h-0 min-w-0 w-full ${
            page === 'home' ? 'overflow-auto p-0' : 'overflow-auto p-4 md:p-6'
          }`}
        >
          {children}
        </main>
        <BottomNav page={page} onNavigate={onNavigate} />
        <HelpButton page={page} />
      </div>
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        page={page}
        onNavigate={onNavigate}
        adminTab={adminTab}
      />
    </div>
  )
}
