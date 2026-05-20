'use client'

import { useState } from 'react'
import type { ActingRole } from '@/lib/acting-role'
import { ACTING_ROLE_LABELS } from '@/lib/acting-role'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_STYLES: Record<ActingRole, string> = {
  admin: 'bg-violet-950/80 border-violet-600/50 text-violet-100',
  coach: 'bg-emerald-950/80 border-emerald-600/50 text-emerald-100',
  user: 'bg-slate-900/90 border-slate-600/50 text-slate-200',
}

export function AdminActingRoleBar() {
  const { isRealAdmin, actingRole, setActingRole, roleSummary } = useAuth()
  const [expanded, setExpanded] = useState(false)

  if (!isRealAdmin) return null

  return (
    <div className={`border-b text-xs sm:text-sm ${ROLE_STYLES[actingRole]}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 sm:px-4 text-left flex items-center justify-between gap-2 hover:bg-black/10 transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-medium">Options développeur (rôle effectif)</span>
        <span className="text-[11px] opacity-80 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 sm:px-4 sm:pb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-t border-white/10">
          <div className="flex-1 min-w-0">
            <p className="font-medium">
              Rôle effectif : <span className="text-white">{ACTING_ROLE_LABELS[actingRole]}</span>
            </p>
            <p className="text-[11px] opacity-80 mt-0.5 truncate">{roleSummary}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {(['admin', 'coach', 'user'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setActingRole(r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  actingRole === r
                    ? 'bg-white/15 ring-1 ring-white/30'
                    : 'bg-black/20 hover:bg-black/30 opacity-80'
                }`}
              >
                {ACTING_ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
