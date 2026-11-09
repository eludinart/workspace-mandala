'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { PLACE_BOUND_PAGES, type AdminTabId } from '@/lib/nav'
import { useAuth } from '@/contexts/AuthContext'
import { socialApi } from '@/api/social'
import { useSocialStore } from '@/store/useSocialStore'
import { AppHeader } from '@/components/layout/AppHeader'
import { PlaceSwitchBanner } from '@/components/layout/PlaceSwitchBanner'
import { BillingCompExpiryBanner } from '@/components/billing/BillingCompExpiryBanner'
import { CheckoutReturnBanner } from '@/components/billing/CheckoutReturnBanner'
import { AdminActingRoleBar } from '@/components/AdminActingRoleBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AppNavPanel } from '@/components/layout/AppNavPanel'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'
import { InstallAppPrompt } from '@/components/InstallAppPrompt'
import { PushNotificationPriming } from '@/components/PushNotificationPriming'
import { HelpButton } from '@/components/help/HelpButton'
import { PullToRefresh } from '@/components/PullToRefresh'
import type { CheckoutReturnState } from '@/lib/checkout-return'
import { useCallback, useEffect, useState } from 'react'
import { useVisibilityPoll } from '@/hooks/useVisibilityPoll'

export function Layout({
  page,
  onNavigate,
  adminTab,
  onBack,
  checkoutReturn,
  onDismissCheckoutReturn,
  children,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
  adminTab?: AdminTabId
  onBack?: () => void
  checkoutReturn?: CheckoutReturnState | null
  onDismissCheckoutReturn?: () => void
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const { communities, loading: communitiesLoading } = useCommunity()
  const fetchClairiereUnread = useSocialStore((s) => s.fetchClairiereUnread)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (communitiesLoading || communities.length > 0) return
    if (PLACE_BOUND_PAGES.includes(page)) onNavigate('home')
  }, [communities.length, communitiesLoading, onNavigate, page])

  const presenceTick = useCallback(() => {
    void socialApi.presenceHeartbeat().catch(() => {})
    void fetchClairiereUnread()
  }, [fetchClairiereUnread])

  useVisibilityPoll(
    'presence',
    presenceTick,
    !!user,
    user && (user as { id?: string | number }).id != null
      ? String((user as { id: string | number }).id)
      : null,
  )

  useEffect(() => {
    setMobileNavOpen(false)
  }, [page])

  if (page === 'messages') {
    return (
      <div className="h-full min-h-0 flex flex-col bg-slate-950 text-slate-100 border-t-4 border-accent">
        <InstallAppPrompt />
        <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">{children}</main>
        <HelpButton page={page} />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col md:flex-row bg-slate-950 text-slate-100 border-t-4 border-accent">
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
        {checkoutReturn && onDismissCheckoutReturn && (
          <CheckoutReturnBanner
            state={checkoutReturn}
            onNavigate={onNavigate}
            onDismiss={onDismissCheckoutReturn}
          />
        )}
        <BillingCompExpiryBanner onNavigate={onNavigate} />
        <AdminActingRoleBar />
        <InstallAppPrompt />
        <PushNotificationPriming />
        <main
          className={`flex-1 min-h-0 min-w-0 w-full flex flex-col ${
            page === 'home' ? 'p-0' : 'p-0'
          }`}
        >
          <PullToRefresh
            page={page}
            className={`flex-1 overflow-auto ${page === 'home' ? 'p-0' : 'p-4 md:p-6'}`}
          >
            {children}
          </PullToRefresh>
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
