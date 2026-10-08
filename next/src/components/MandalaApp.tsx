'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { CommunityProvider } from '@/contexts/CommunityContext'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/views/LoginPage'
import { HomePage } from '@/views/HomePage'
import { SkillsPage } from '@/views/SkillsPage'
import { DirectoryPage } from '@/views/DirectoryPage'
import { queueSkillFiche } from '@/components/skills/SkillsDirectory'
import { ResourcesPage } from '@/views/ResourcesPage'
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
import { PlaceInvitesPage } from '@/views/PlaceInvitesPage'
import { NotificationsPage } from '@/views/NotificationsPage'
import { CharterPage } from '@/views/CharterPage'
import { PlaceListPage } from '@/views/PlaceListPage'
import { CirclesJournalPage } from '@/views/CirclesJournalPage'
import { OnboardingGate } from '@/components/onboarding/OnboardingGate'
import { TelemetryTracker } from '@/components/TelemetryTracker'
import type { AdminTabId } from '@/lib/nav'

export type MandalaPage =
  | 'home'
  | 'directory'
  | 'calendar'
  | 'events'
  | 'members'
  | 'messages'
  | 'skills'
  | 'resources'
  | 'notifications'
  | 'account'
  | 'charter'
  | 'places-map'
  | 'place-settings'
  | 'place-profile'
  | 'place-charter'
  | 'place-members'
  | 'place-invites'
  | 'place-announcements'
  | 'managed-places'
  | 'courses'
  | 'logistics'
  | 'circles'
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
  'directory',
  'calendar',
  'events',
  'members',
  'messages',
  'skills',
  'resources',
  'notifications',
  'account',
  'charter',
  'places-map',
  'place-settings',
  'place-profile',
  'place-charter',
  'place-members',
  'place-invites',
  'place-announcements',
  'managed-places',
  'courses',
  'logistics',
  'circles',
  'admin',
]

type HistoryNav = 'push' | 'replace' | 'skip' | 'idle'

type AppHistoryState = {
  mdl: true
  depth: number
  page: MandalaPage
  channelId: string | null
  userId: string | null
  community: string | null
  eventId: number | null
  adminTab: AdminTabId
  hub: string | null
  /** Profondeur de l’écran d’avant les messages : le retour « Mandala » y revient. */
  returnDepth: number | null
}

function buildAppUrl(s: Pick<AppHistoryState, 'page' | 'channelId' | 'userId' | 'community' | 'eventId' | 'adminTab' | 'hub'>): string {
  const params = new URLSearchParams()
  params.set('page', s.page)
  if (s.page === 'messages') {
    if (s.channelId) params.set('channelId', s.channelId)
    if (s.userId) params.set('userId', s.userId)
    if (s.community) params.set('community', s.community)
  }
  if (s.page === 'events' && s.eventId != null) params.set('eventId', String(s.eventId))
  if (s.page === 'admin' && s.adminTab !== 'people') params.set('adminTab', s.adminTab)
  if (s.page === 'managed-places' && s.hub) params.set('hub', s.hub)
  return `/app?${params.toString()}`
}

function homeHistory(depth = 1): AppHistoryState {
  return {
    mdl: true,
    depth,
    page: 'home',
    channelId: null,
    userId: null,
    community: null,
    eventId: null,
    adminTab: 'people',
    hub: null,
    returnDepth: null,
  }
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  if (!value || typeof value !== 'object') return false
  const v = value as AppHistoryState & { exitGuard?: boolean }
  if (v.exitGuard) return false
  return v.mdl === true && APP_PAGES_FROM_URL.includes(v.page)
}

function isExitGuard(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as { mdl?: boolean; exitGuard?: boolean }).mdl === true && (value as { exitGuard?: boolean }).exitGuard === true
}

/** Garde posée sous l’accueil : le retour qui sortirait de Mandala arrive ici. */
function pushAppStack(entries: AppHistoryState[]) {
  const root = entries[0] ?? homeHistory(1)
  window.history.replaceState({ mdl: true, exitGuard: true }, '', buildAppUrl(root))
  for (const entry of entries) {
    window.history.pushState(entry, '', buildAppUrl(entry))
  }
}

export function MandalaApp() {
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [page, setPage] = useState<MandalaPage>('home')
  const pageRef = useRef<MandalaPage>('home')
  pageRef.current = page
  const [messagesReturnPage, setMessagesReturnPage] = useState<MandalaPage>('home')
  const [messagesOpenUserId, setMessagesOpenUserId] = useState<string | null>(null)
  const [messagesOpenChannelId, setMessagesOpenChannelId] = useState<string | null>(null)
  const [messagesCommunitySlug, setMessagesCommunitySlug] = useState<string | null>(null)
  const [openEventId, setOpenEventId] = useState<number | null>(null)
  const [adminTab, setAdminTab] = useState<AdminTabId>('people')
  const [managedPlaceHubSlug, setManagedPlaceHubSlug] = useState<string | null>(null)
  const historyAction = useRef<HistoryNav>('idle')
  const appStateRef = useRef<AppHistoryState | null>(null)
  const rootRef = useRef<AppHistoryState>(homeHistory(1))
  const guardReady = useRef(false)
  const [historyDepth, setHistoryDepth] = useState(1)

  const remember = useCallback((st: AppHistoryState) => {
    appStateRef.current = st
    if (st.depth === 1) rootRef.current = st
    setHistoryDepth(st.depth)
  }, [])

  const showHistory = useCallback((st: AppHistoryState) => {
    remember(st)
    historyAction.current = 'skip'
    setPage(st.page)
    setMessagesOpenChannelId(st.page === 'messages' ? st.channelId : null)
    setMessagesOpenUserId(st.page === 'messages' ? st.userId : null)
    setMessagesCommunitySlug(st.page === 'messages' ? st.community : null)
    setOpenEventId(st.page === 'events' ? st.eventId : null)
    setAdminTab(st.adminTab ?? 'people')
    setManagedPlaceHubSlug(st.page === 'managed-places' ? st.hub : null)
  }, [remember])

  const navigate = useCallback<MandalaNavigate>((p, opts) => {
    if (p === 'messages' && pageRef.current !== 'messages') {
      setMessagesReturnPage(pageRef.current)
    }
    if (p !== 'account' && typeof window !== 'undefined' && window.__mdlSkillsDirty) {
      const stay = window.confirm(
        'Votre fiche de compétences a des modifications non enregistrées. Rester sur la page pour les garder ?'
      )
      if (stay) return
      window.__mdlSkillsDirty = false
    }
    if (typeof window !== 'undefined' && window.__mdlResourcesDirty && p !== window.__mdlResourcesHost) {
      const stay = window.confirm(
        'Ce brouillon de ressource n’est pas publié. Rester sur la page pour le garder ?'
      )
      if (stay) return
      window.__mdlResourcesDirty = false
    }
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
    historyAction.current = 'push'
    setPage(p)
  }, [])

  const selectMessageChannel = useCallback((channelId: number | null) => {
    setMessagesOpenChannelId((current) => {
      const next = channelId != null ? String(channelId) : null
      if ((current ?? null) === next) return current
      if (historyAction.current !== 'skip') {
        historyAction.current = next == null || current ? 'replace' : 'push'
      }
      return next
    })
  }, [])

  const goBack = useCallback(() => {
    const st = window.history.state as AppHistoryState | null
    if (!isAppHistoryState(st) || st.depth <= 1) return
    if (pageRef.current === 'account' && window.__mdlSkillsDirty) {
      const stay = window.confirm(
        'Votre fiche de compétences a des modifications non enregistrées. Rester sur la page pour les garder ?'
      )
      if (stay) return
      window.__mdlSkillsDirty = false
    }
    if (window.__mdlResourcesDirty && pageRef.current === window.__mdlResourcesHost) {
      const stay = window.confirm(
        'Ce brouillon de ressource n’est pas publié. Rester sur la page pour le garder ?'
      )
      if (stay) return
      window.__mdlResourcesDirty = false
    }
    window.history.back()
  }, [])

  const leaveMessages = useCallback(() => {
    const st = window.history.state as AppHistoryState | null
    if (st?.mdl && st.page === 'messages' && st.returnDepth != null && st.depth > st.returnDepth) {
      window.history.go(st.returnDepth - st.depth)
      return
    }
    navigate(messagesReturnPage === 'messages' ? 'home' : messagesReturnPage)
  }, [messagesReturnPage, navigate])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const pageParam = params.get('page') as MandalaPage | null
    if (!pageParam || !APP_PAGES_FROM_URL.includes(pageParam)) return
    const channelId = params.get('channelId') ?? params.get('channel_id')
    const community = params.get('community') ?? params.get('community_slug')
    const userId = params.get('userId') ?? params.get('user_id')
    const eventIdRaw = params.get('eventId')
    const eventId = eventIdRaw ? Number(eventIdRaw) : undefined
    const adminTabRaw = params.get('adminTab')
    const adminTabs: AdminTabId[] = ['people', 'communications', 'telemetry', 'places', 'support']
    const adminTabParam =
      adminTabRaw && adminTabs.includes(adminTabRaw as AdminTabId)
        ? (adminTabRaw as AdminTabId)
        : undefined
    const hub = params.get('hub')
    navigate(pageParam, {
      messagesChannelId: channelId?.trim() || undefined,
      messagesUserId: userId?.trim() || undefined,
      communitySlug: community?.trim() || undefined,
      eventId: eventId != null && Number.isFinite(eventId) ? eventId : undefined,
      adminTab: adminTabParam,
      managedPlaceHub: hub,
    })
    // bootstrap URL une seule fois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    if (!user) return
    const snap: AppHistoryState = {
      mdl: true,
      depth: 1,
      page,
      channelId: page === 'messages' ? messagesOpenChannelId : null,
      userId: page === 'messages' ? messagesOpenUserId : null,
      community: page === 'messages' ? messagesCommunitySlug : null,
      eventId: page === 'events' ? openEventId : null,
      adminTab,
      hub: page === 'managed-places' ? managedPlaceHubSlug : null,
      returnDepth: null,
    }
    const nextUrl = buildAppUrl(snap)
    const cur = `${window.location.pathname}${window.location.search}`
    const prev = window.history.state as AppHistoryState | null
    const action = historyAction.current

    if (!isAppHistoryState(prev)) {
      historyAction.current = 'idle'
      const atHome = snap.page === 'home' && !snap.channelId && !snap.userId
      let current: AppHistoryState
      if (atHome) {
        current = { ...homeHistory(1) }
        pushAppStack([current])
      } else if (snap.page === 'messages' && snap.channelId) {
        const list = { ...snap, channelId: null, depth: 2, returnDepth: 1 }
        current = { ...snap, depth: 3, returnDepth: 1 }
        pushAppStack([homeHistory(1), list, current])
      } else {
        current = { ...snap, depth: 2, returnDepth: snap.page === 'messages' ? 1 : null }
        pushAppStack([homeHistory(1), current])
      }
      remember(current)
      guardReady.current = true
      return
    }

    if (prev.depth === 1 && !guardReady.current && cur === nextUrl) {
      guardReady.current = true
      window.history.replaceState({ mdl: true, exitGuard: true }, '', cur)
      window.history.pushState(prev, '', cur)
      remember(prev)
      return
    }

    if (action === 'skip') {
      historyAction.current = 'idle'
      if (cur !== nextUrl) {
        const kept = {
          ...snap,
          depth: prev.depth,
          returnDepth: snap.page === 'messages' ? prev.returnDepth : null,
        }
        window.history.replaceState(kept, '', nextUrl)
        remember(kept)
      }
      return
    }

    if (cur === nextUrl) {
      historyAction.current = 'idle'
      return
    }

    historyAction.current = 'idle'
    const stayInMessages = snap.page === 'messages' && prev.page === 'messages'
    const returnDepth = snap.page === 'messages' ? (stayInMessages ? prev.returnDepth : prev.depth) : null
    let written: AppHistoryState
    if (action === 'push' && snap.page === 'messages' && snap.channelId && !stayInMessages) {
      const list = { ...snap, channelId: null, userId: null, depth: prev.depth + 1, returnDepth }
      written = { ...snap, depth: prev.depth + 2, returnDepth }
      window.history.pushState(list, '', buildAppUrl(list))
      window.history.pushState(written, '', nextUrl)
    } else if (action === 'push') {
      written = { ...snap, depth: prev.depth + 1, returnDepth }
      window.history.pushState(written, '', nextUrl)
    } else {
      written = { ...snap, depth: prev.depth, returnDepth }
      window.history.replaceState(written, '', nextUrl)
    }
    remember(written)
  }, [
    mounted,
    user,
    page,
    messagesOpenChannelId,
    messagesOpenUserId,
    messagesCommunitySlug,
    openEventId,
    adminTab,
    managedPlaceHubSlug,
    remember,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = (event: PopStateEvent) => {
      if (isExitGuard(event.state)) {
        const leave = window.confirm('Êtes-vous sûr de vouloir quitter l\'application ?')
        const restore = rootRef.current ?? homeHistory(1)
        if (!leave) {
          historyAction.current = 'skip'
          window.history.pushState(restore, '', buildAppUrl(restore))
          showHistory(restore)
          return
        }
        window.history.back()
        return
      }
      const st = event.state as AppHistoryState | null
      if (!isAppHistoryState(st)) return
      showHistory(st)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [showHistory])

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
        return (
          <MembersPage
            onNavigate={navigate}
            onOpenMessages={(userId) => navigate('messages', { messagesUserId: userId })}
          />
        )
      case 'skills':
        return <SkillsPage onNavigate={navigate} />
      case 'resources':
        return <ResourcesPage onNavigate={navigate} />
      case 'messages':
        return (
          <MessagesPage
            openWithUserId={messagesOpenUserId}
            openWithChannelId={messagesOpenChannelId}
            openCommunitySlug={messagesCommunitySlug}
            onOpenChannel={selectMessageChannel}
            onLeave={leaveMessages}
            onOpenProfile={(userId) => {
              queueSkillFiche(userId)
              navigate('skills')
            }}
          />
        )
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} />
      case 'account':
        return <AccountPage onNavigate={navigate} />
      case 'charter':
        return <CharterPage onNavigate={navigate} />
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
      case 'place-invites':
        return <PlaceInvitesPage onNavigate={navigate} />
      case 'place-announcements':
        return <PlaceAnnouncementsPage onNavigate={navigate} />
      case 'courses':
        return <PlaceListPage kind="courses" />
      case 'logistics':
        return <PlaceListPage kind="logistics" />
      case 'circles':
        return <CirclesJournalPage />
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
      case 'directory':
        return <DirectoryPage onNavigate={navigate} />
      default:
        return <HomePage onNavigate={navigate} />
    }
  }, [page, messagesOpenUserId, messagesOpenChannelId, messagesCommunitySlug, openEventId, adminTab, managedPlaceHubSlug, navigate, selectMessageChannel, leaveMessages])

  if (!mounted) {
    return <div className="flex-1 h-full min-h-0 bg-slate-950" aria-busy="true" />
  }

  if (loading) {
    return (
      <div className="flex-1 h-full min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-center">
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
        <Layout
          page={page}
          onNavigate={navigate}
          adminTab={adminTab}
          onBack={historyDepth > 1 ? goBack : undefined}
        >
          {content}
        </Layout>
      </OnboardingGate>
    </CommunityProvider>
  )
}
