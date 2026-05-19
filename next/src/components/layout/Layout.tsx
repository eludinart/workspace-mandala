'use client'

import type { MandalaPage } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'

const NAV: { id: MandalaPage; label: string; icon: string }[] = [
  { id: 'home', label: 'Accueil', icon: '🏠' },
  { id: 'events', label: 'Événements', icon: '📅' },
  { id: 'members', label: 'Membres', icon: '👥' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'account', label: 'Compte', icon: '⚙️' },
]

export function Layout({
  page,
  onNavigate,
  children,
}: {
  page: MandalaPage
  onNavigate: (p: MandalaPage) => void
  children: React.ReactNode
}) {
  const { user, logout, isAdmin } = useAuth()
  const { communities, active, setActiveSlug, loading } = useCommunity()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100">
      <aside className="md:w-56 border-b md:border-b-0 md:border-r border-slate-800 p-4 flex flex-col gap-4">
        <div>
          <p className="text-lg font-bold tracking-tight">Mandala</p>
          <p className="text-[10px] text-slate-500">Lieux & communautés</p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Communauté</p>
          {loading ? (
            <p className="text-xs text-slate-400">…</p>
          ) : (
            <select
              value={active?.slug ?? ''}
              onChange={(e) => setActiveSlug(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
            >
              {communities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                page === item.id
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-2 border-t border-slate-800 text-xs text-slate-500">
          <p className="truncate">{String((user as { email?: string })?.email ?? '')}</p>
          {isAdmin && <p className="text-violet-400">Admin</p>}
          <button
            type="button"
            onClick={() => logout()}
            className="mt-2 text-red-400 hover:underline"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-auto p-4 md:p-8">{children}</main>
    </div>
  )
}

