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
import { useMemo, useState } from 'react'

export type MandalaPage = 'home' | 'events' | 'members' | 'messages' | 'account'

export function MandalaApp() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<MandalaPage>('home')

  const content = useMemo(() => {
    switch (page) {
      case 'events':
        return <EventsPage />
      case 'members':
        return <MembersPage />
      case 'messages':
        return <MessagesPage />
      case 'account':
        return <AccountPage />
      default:
        return <HomePage onNavigate={setPage} />
    }
  }, [page])

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
      <Layout page={page} onNavigate={setPage}>
        {content}
      </Layout>
    </CommunityProvider>
  )
}
