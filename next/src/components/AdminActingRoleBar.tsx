'use client'

import type { ActingRole } from '@/lib/acting-role'
import { ACTING_ROLE_LABELS } from '@/lib/acting-role'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_STYLES: Record<ActingRole, string> = {
  admin: 'bg-violet-600/10 border-violet-500/40 text-slate-100',
  site_manager: 'bg-emerald-600/10 border-emerald-500/40 text-slate-100',
  user: 'bg-slate-900/80 border-slate-600/40 text-slate-200',
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
          <p className="font-medium truncate text-slate-100">
            Vue développeur —{' '}
            <span className="text-slate-50">{ACTING_ROLE_LABELS[actingRole]}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 hidden sm:block">{roleSummary}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0" role="group" aria-label="Choisir le rôle effectif">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActingRole(r)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                actingRole === r
                  ? 'bg-violet-600/20 ring-1 ring-violet-500/40 text-slate-100'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
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
