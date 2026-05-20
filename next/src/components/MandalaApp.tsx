'use client'

import { useAuth } from '@/contexts/AuthContext'
import { CommunityProvider } from '@/contexts/CommunityContext'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/views/LoginPage'
import { HomePage } from '@/views/HomePage'
import { MembersPage } from '@/views/MembersPage'
import { MessagesPage } from '@/views/MessagesPage'
import { EventsPage } from '@/views/EventsPage'
import { AccountPage } from '@/views/AccountPage'
import { AdminPage } from '@/views/AdminPage'
import { NotificationsPage } from '@/views/NotificationsPage'
import { PushNotificationPriming } from '@/components/PushNotificationPriming'
import { TelemetryTracker } from '@/components/TelemetryTracker'
import { useCallback, useMemo, useState } from 'react'

export type MandalaPage =
  | 'home'
  | 'events'
  | 'members'
  | 'messages'
  | 'notifications'
  | 'account'
  | 'admin'

export type MandalaNavigate = (
  p: MandalaPage,
  opts?: { messagesUserId?: string; eventId?: number | null }
) => void

export function MandalaApp() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<MandalaPage>('home')
  const [messagesOpenUserId, setMessagesOpenUserId] = useState<string | null>(null)
  const [openEventId, setOpenEventId] = useState<number | null>(null)

  const navigate = useCallback<MandalaNavigate>((p, opts) => {
    if (opts?.messagesUserId) setMessagesOpenUserId(opts.messagesUserId)
    else if (p !== 'messages') setMessagesOpenUserId(null)
    if (opts?.eventId !== undefined) setOpenEventId(opts.eventId)
    else if (p !== 'events') setOpenEventId(null)
    setPage(p)
  }, [])

  const content = useMemo(() => {
    switch (page) {
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
        return <MessagesPage openWithUserId={messagesOpenUserId} />
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} />
      case 'account':
        return <AccountPage onNavigate={navigate} />
      case 'admin':
        return <AdminPage />
      default:
        return <HomePage onNavigate={navigate} />
    }
  }, [page, messagesOpenUserId, openEventId, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-sm text-slate-400">Chargement…</p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <CommunityProvider>
      <TelemetryTracker page={page} />
      <PushNotificationPriming />
      <Layout page={page} onNavigate={navigate}>
        {content}
      </Layout>
    </CommunityProvider>
  )
}
