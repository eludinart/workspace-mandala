'use client'

import type { ActingRole } from '@/lib/acting-role'
import { ACTING_ROLE_LABELS } from '@/lib/acting-role'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_STYLES: Record<ActingRole, string> = {
  admin: 'bg-violet-950/90 border-violet-600/50 text-violet-100',
  site_manager: 'bg-emerald-950/90 border-emerald-600/50 text-emerald-100',
  user: 'bg-slate-900/95 border-slate-600/50 text-slate-200',
}

const ROLES: ActingRole[] = ['admin', 'site_manager', 'user']

export function AdminActingRoleBar() {
  const { isRealAdmin, actingRole, setActingRole, roleSummary } = useAuth()

  if (!isRealAdmin) return null

  return (
    <div
      className={`shrink-0 border-b text-xs sm:text-sm ${ROLE_STYLES[actingRole]}`}
      role="region"
      aria-label="Simulation de rôle développeur"
    >
      <div className="px-3 py-2 sm:px-4 flex flex-row items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            Vue développeur —{' '}
            <span className="text-white">{ACTING_ROLE_LABELS[actingRole]}</span>
          </p>
          <p className="text-[11px] opacity-80 mt-0.5 line-clamp-1 hidden sm:block">{roleSummary}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0" role="group" aria-label="Choisir le rôle effectif">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActingRole(r)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                actingRole === r
                  ? 'bg-white/15 ring-1 ring-white/30 text-white'
                  : 'bg-black/20 hover:bg-black/30 opacity-80'
              }`}
              aria-pressed={actingRole === r}
            >
              {ACTING_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
