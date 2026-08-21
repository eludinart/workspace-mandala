'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { useAuth } from '@/contexts/AuthContext'
import { socialApi } from '@/api/social'
import { useSocialStore } from '@/store/useSocialStore'
import { AppHeader } from '@/components/layout/AppHeader'
import { PlaceSwitchBanner } from '@/components/layout/PlaceSwitchBanner'
import { AdminActingRoleBar } from '@/components/AdminActingRoleBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AppNavPanel } from '@/components/layout/AppNavPanel'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'
import { useEffect, useState } from 'react'

export function Layout({
  page,
  onNavigate,
  children,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
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

  return (
    <div className="h-full min-h-0 flex flex-col md:flex-row bg-slate-950 text-slate-100">
      <aside className="hidden md:flex md:w-56 lg:w-60 border-r border-slate-800 shrink-0 self-stretch">
        <div className="w-full p-3 flex flex-col min-h-0 sticky top-0 max-h-full">
          <AppNavPanel page={page} onNavigate={onNavigate} />
        </div>
      </aside>

      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <AppHeader
          page={page}
          onNavigate={onNavigate}
          onOpenMenu={() => setMobileNavOpen(true)}
        />
        <PlaceSwitchBanner />
        <AdminActingRoleBar />
        <main
          className={`flex-1 min-h-0 p-4 md:p-6 ${
            page === 'messages'
              ? 'flex flex-col overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6'
              : 'overflow-auto pb-24'
          }`}
        >
          {children}
        </main>
      </div>

      <BottomNav page={page} onNavigate={onNavigate} />
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        page={page}
        onNavigate={onNavigate}
      />
    </div>
  )
}
