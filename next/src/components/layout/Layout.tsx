'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { useAuth } from '@/contexts/AuthContext'
import { socialApi } from '@/api/social'
import { useSocialStore } from '@/store/useSocialStore'
import { AppHeader } from '@/components/layout/AppHeader'
import { AdminActingRoleBar } from '@/components/AdminActingRoleBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { MAIN_NAV } from '@/lib/nav'
import { useEffect } from 'react'

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100">
      <aside className="hidden md:flex md:w-52 border-r border-slate-800 p-4 flex-col gap-2 shrink-0">
        <div className="mb-4">
          <p className="text-lg font-bold tracking-tight">Mandala</p>
          <p className="text-[10px] text-slate-500">Communautés & événements</p>
        </div>
        <nav className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <NavItem key={item.id} item={item} page={page} onNavigate={onNavigate} />
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <AppHeader page={page} onNavigate={onNavigate} />
        {page === 'admin' && <AdminActingRoleBar />}
        <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>

      <BottomNav page={page} onNavigate={onNavigate} />
    </div>
  )
}

function NavItem({
  item,
  page,
  onNavigate,
}: {
  item: (typeof MAIN_NAV)[number]
  page: MandalaPage
  onNavigate: MandalaNavigate
}) {
  const clairiereUnread = useSocialStore((s) => s.clairiereUnreadCount)
  const active = page === item.id

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40'
          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
      }`}
    >
      <span>{item.icon}</span>
      {item.label}
      {item.id === 'messages' && clairiereUnread > 0 && (
        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-violet-600 text-[10px] text-white">
          {clairiereUnread}
        </span>
      )}
    </button>
  )
}
