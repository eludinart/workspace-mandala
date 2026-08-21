'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { CommunityProvider } from '@/contexts/CommunityContext'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/views/LoginPage'
import { HomePage } from '@/views/HomePage'
import { MembersPage } from '@/views/MembersPage'
import { MessagesPage } from '@/views/MessagesPage'
import { EventsPage } from '@/views/EventsPage'
import { CalendarPage } from '@/views/CalendarPage'
import { AccountPage } from '@/views/AccountPage'
import { PlaceSettingsPage } from '@/views/PlaceSettingsPage'
import { DiscoverWallPage } from '@/views/DiscoverWallPage'
import { ManagedPlacesPage } from '@/views/ManagedPlacesPage'
import { AdminPage } from '@/views/AdminPage'
import { PlaceAnnouncementsPage } from '@/views/PlaceAnnouncementsPage'
import { NotificationsPage } from '@/views/NotificationsPage'
import { CharterPage } from '@/views/CharterPage'
import { OnboardingGate } from '@/components/onboarding/OnboardingGate'
import { TelemetryTracker } from '@/components/TelemetryTracker'
import type { AdminTabId } from '@/lib/nav'

export type MandalaPage =
  | 'home'
  | 'calendar'
  | 'events'
  | 'members'
  | 'messages'
  | 'notifications'
  | 'account'
  | 'charter'
  | 'places-map'
  | 'place-settings'
  | 'place-profile'
  | 'place-charter'
  | 'place-members'
  | 'place-announcements'
  | 'managed-places'
  | 'admin'

export type MandalaNavigate = (
  p: MandalaPage,
  opts?: {
    messagesUserId?: string
    messagesChannelId?: string
    communitySlug?: string
    eventId?: number | null
    adminTab?: AdminTabId
    /** Ouvre le hub d’un lieu dans « Mes lieux » (slug) ; `null` = liste des lieux */
    managedPlaceHub?: string | null
  }
) => void

const APP_PAGES_FROM_URL: MandalaPage[] = [
  'home',
  'calendar',
  'events',
  'members',
  'messages',
  'notifications',
  'account',
  'charter',
  'places-map',
  'place-settings',
  'place-profile',
  'place-charter',
  'place-members',
  'place-announcements',
  'managed-places',
  'admin',
]

export function MandalaApp() {
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [page, setPage] = useState<MandalaPage>('home')
  const [messagesOpenUserId, setMessagesOpenUserId] = useState<string | null>(null)
  const [messagesOpenChannelId, setMessagesOpenChannelId] = useState<string | null>(null)
  const [messagesCommunitySlug, setMessagesCommunitySlug] = useState<string | null>(null)
  const [openEventId, setOpenEventId] = useState<number | null>(null)
  const [adminTab, setAdminTab] = useState<AdminTabId>('people')
  const [managedPlaceHubSlug, setManagedPlaceHubSlug] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navigate = useCallback<MandalaNavigate>((p, opts) => {
    if (opts?.messagesChannelId) {
      setMessagesOpenChannelId(opts.messagesChannelId)
      setMessagesOpenUserId(null)
    } else if (opts?.messagesUserId) {
      setMessagesOpenUserId(opts.messagesUserId)
      setMessagesOpenChannelId(null)
    } else if (p !== 'messages') {
      setMessagesOpenUserId(null)
      setMessagesOpenChannelId(null)
    }

    if (opts?.communitySlug) setMessagesCommunitySlug(opts.communitySlug)
    else if (p !== 'messages') setMessagesCommunitySlug(null)

    if (opts?.eventId !== undefined) setOpenEventId(opts.eventId)
    else if (p !== 'events') setOpenEventId(null)
    if (opts?.adminTab) setAdminTab(opts.adminTab)
    else if (p !== 'admin') setAdminTab('people')
    if (p === 'managed-places') {
      if (opts && 'managedPlaceHub' in (opts ?? {})) {
        setManagedPlaceHubSlug(opts.managedPlaceHub ?? null)
      } else {
        setManagedPlaceHubSlug(null)
      }
    }
    setPage(p)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const pageParam = params.get('page') as MandalaPage | null
    if (pageParam && APP_PAGES_FROM_URL.includes(pageParam)) {
      const channelId = params.get('channelId') ?? params.get('channel_id')
      const community = params.get('community') ?? params.get('community_slug')
      const userId = params.get('userId') ?? params.get('user_id')
      navigate(pageParam, {
        messagesChannelId: channelId?.trim() || undefined,
        messagesUserId: userId?.trim() || undefined,
        communitySlug: community?.trim() || undefined,
      })
    }
  }, [navigate])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (!data || data.type !== 'MDL_PUSH_NAV' || !data.url) return
      try {
        const u = new URL(data.url, window.location.origin)
        const pageParam = u.searchParams.get('page') as MandalaPage | null
        if (pageParam && APP_PAGES_FROM_URL.includes(pageParam)) {
          navigate(pageParam, {
            messagesChannelId: u.searchParams.get('channelId') ?? undefined,
            messagesUserId: u.searchParams.get('userId') ?? undefined,
            communitySlug: u.searchParams.get('community') ?? undefined,
          })
        } else if (u.pathname.startsWith('/app')) {
          navigate('notifications')
        }
      } catch {
        navigate('notifications')
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  const content = useMemo(() => {
    switch (page) {
      case 'calendar':
        return <CalendarPage />
      case 'events':
        return (
          <EventsPage
            openEventId={openEventId}
            onOpenEvent={(id) => setOpenEventId(id)}
          />
        )
      case 'members':
        return <MembersPage onOpenMessages={(userId) => navigate('messages', { messagesUserId: userId })} />
      case 'messages':
        return (
          <MessagesPage
            openWithUserId={messagesOpenUserId}
            openWithChannelId={messagesOpenChannelId}
            openCommunitySlug={messagesCommunitySlug}
          />
        )
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} />
      case 'account':
        return <AccountPage onNavigate={navigate} />
      case 'charter':
        return <CharterPage />
      case 'places-map':
        return <DiscoverWallPage onNavigate={navigate} />
      case 'place-settings':
      case 'place-profile':
        return <PlaceSettingsPage section="profile" onNavigate={navigate} />
      case 'place-charter':
        return <PlaceSettingsPage section="charter" onNavigate={navigate} />
      case 'place-members':
        return (
          <MembersPage
            organisationMode
            onNavigate={navigate}
            onOpenMessages={(userId) => navigate('messages', { messagesUserId: userId })}
          />
        )
      case 'place-announcements':
        return <PlaceAnnouncementsPage onNavigate={navigate} />
      case 'managed-places':
        return (
          <ManagedPlacesPage
            hubSlug={managedPlaceHubSlug}
            onHubSlugChange={setManagedPlaceHubSlug}
            onNavigate={navigate}
          />
        )
      case 'admin':
        return <AdminPage initialTab={adminTab} />
      default:
        return <HomePage onNavigate={navigate} />
    }
  }, [page, messagesOpenUserId, messagesOpenChannelId, messagesCommunitySlug, openEventId, adminTab, managedPlaceHubSlug, navigate])

  if (!mounted) {
    return <div className="min-h-screen bg-slate-950" aria-busy="true" />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center">
        <p className="text-sm text-slate-400">Chargement…</p>
        <p className="text-xs text-slate-600 max-w-sm">
          Si cet écran reste bloqué, vérifiez que le serveur tourne (
          <code className="text-slate-500">npm run dev.vps</code>) et que le tunnel MariaDB est actif.
        </p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <CommunityProvider>
      <OnboardingGate>
        <TelemetryTracker page={page} />
        <Layout page={page} onNavigate={navigate}>
          {content}
        </Layout>
      </OnboardingGate>
    </CommunityProvider>
  )
}
