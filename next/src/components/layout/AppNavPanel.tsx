'use client'

import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { useAuth } from '@/contexts/AuthContext'
import { useNavAccess } from '@/hooks/useNavAccess'
import {
  ADMIN_NAV,
  MAIN_NAV,
  ORGANISATION_NAV,
  ORGANISATION_PLACE_PAGES,
  SECONDARY_NAV,
  type AdminTabId,
} from '@/lib/nav'
import { useSocialStore } from '@/store/useSocialStore'
import { ActivePlaceBar } from '@/components/layout/ActivePlaceBar'

function NavButton({
  active,
  icon,
  label,
  description,
  badge,
  onClick,
  variant = 'default',
}: {
  active?: boolean
  icon: string
  label: string
  description?: string
  badge?: number
  onClick: () => void
  variant?: 'default' | 'admin' | 'manager'
}) {
  const variantClass =
    variant === 'admin'
      ? active
        ? 'bg-amber-600/25 text-slate-100 border-amber-500/50'
        : 'text-slate-300 hover:bg-slate-900/40 hover:text-slate-100 border-transparent'
      : variant === 'manager'
        ? active
          ? 'bg-sky-600/25 text-slate-100 border-sky-500/50'
          : 'text-slate-300 hover:bg-slate-900/40 hover:text-slate-100 border-transparent'
        : active
          ? 'bg-violet-600/30 text-slate-100 border-violet-500/40'
          : 'text-slate-300 hover:bg-slate-900/40 hover:text-slate-100 border-transparent'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border text-left ${variantClass}`}
    >
      <span className="text-base shrink-0 mt-0.5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate">{label}</span>
          {badge != null && badge > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-600 text-[10px] text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        {description && (
          <span className="block text-[11px] font-normal text-slate-400 mt-0.5">{description}</span>
        )}
      </span>
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
      {children}
    </p>
  )
}

export function AppNavPanel({
  page,
  onNavigate,
  onItemClick,
  showBranding = true,
}: {
  page: MandalaPage
  onNavigate: MandalaNavigate
  onItemClick?: () => void
  showBranding?: boolean
}) {
  const { logout, isRealAdmin, setActingRole, showAdminUi } = useAuth()
  const { isAppAdmin, isSiteManager, roleLabel } = useNavAccess()
  const clairiereUnread = useSocialStore((s) => s.clairiereUnreadCount)

  const go = (target: MandalaPage, opts?: { adminTab?: AdminTabId }) => {
    if (target === 'admin' && isRealAdmin && !showAdminUi) {
      setActingRole('admin')
    }
    onNavigate(target, opts)
    onItemClick?.()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {showBranding && (
        <div className="px-3 pb-3 border-b border-slate-800 shrink-0 space-y-3">
          <div>
            <p className="text-lg font-bold tracking-tight">Mandala</p>
            <p className="text-[10px] text-slate-500">Communautés & événements</p>
            <p className="mt-2 inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-400">
              {roleLabel}
            </p>
          </div>
          <ActivePlaceBar />
        </div>
      )}

      {!showBranding && (
        <div className="px-2 pb-2 border-b border-slate-800 shrink-0">
          <ActivePlaceBar />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-1">
        <nav className="px-2 pt-1">
          <NavButton
            active={page === 'places-map'}
            icon="🧭"
            label="Découvrir"
            description="Carte, événements & actualités"
            onClick={() => go('places-map')}
          />
        </nav>

        <SectionTitle>Navigation</SectionTitle>
        <nav className="flex flex-col gap-0.5 px-2">
          {MAIN_NAV.map((item) => (
            <NavButton
              key={item.id}
              active={page === item.id}
              icon={item.icon}
              label={item.label}
              badge={item.id === 'messages' ? clairiereUnread : undefined}
              onClick={() => go(item.id)}
            />
          ))}
        </nav>

        {isSiteManager && (
          <>
            <SectionTitle>Organisation</SectionTitle>
            <nav className="flex flex-col gap-0.5 px-2">
              {ORGANISATION_NAV.map((item) => (
                <NavButton
                  key={`org-${item.id}`}
                  active={
                    page === item.id ||
                    (item.id === 'managed-places' && ORGANISATION_PLACE_PAGES.includes(page))
                  }
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  variant="manager"
                  onClick={() => go(item.id)}
                />
              ))}
            </nav>
          </>
        )}

        <SectionTitle>Compte</SectionTitle>
        <nav className="flex flex-col gap-0.5 px-2">
          {SECONDARY_NAV.map((item) => (
            <NavButton
              key={item.id}
              active={page === item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => go(item.id)}
            />
          ))}
        </nav>

        {isAppAdmin && (
          <>
            <SectionTitle>Administration application</SectionTitle>
            <nav className="flex flex-col gap-0.5 px-2">
              {ADMIN_NAV.map((item) => (
                <NavButton
                  key={item.id}
                  active={page === 'admin'}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  variant="admin"
                  onClick={() => go('admin', { adminTab: item.adminTab })}
                />
              ))}
            </nav>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800 p-2">
        <button
          type="button"
          onClick={() => {
            logout()
            onItemClick?.()
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-950/30 transition-colors"
        >
          <span aria-hidden>🚪</span>
          Déconnexion
        </button>
      </div>
    </div>
  )
}
