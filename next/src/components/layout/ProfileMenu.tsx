'use client'

import { useEffect, useRef, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/UserAvatar'

export function ProfileMenu({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { user, logout, isRealAdmin, showAdminUi, setActingRole } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const email = String((user as { email?: string })?.email ?? '')
  const avatar = (user as { avatar?: string })?.avatar
  const avatarEmoji = (user as { avatar_emoji?: string })?.avatar_emoji

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-800/80 transition-colors"
        aria-label="Mon compte"
        aria-expanded={open}
      >
        <UserAvatar avatar={avatar} avatarEmoji={avatarEmoji} size="sm" alt={email} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-50 py-1 text-sm">
          <p className="px-3 py-2 text-xs text-slate-500 truncate border-b border-slate-800">{email}</p>
          <button
            type="button"
            onClick={() => {
              onNavigate('account')
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200"
          >
            Mon compte
          </button>
          {isRealAdmin && (
            <button
              type="button"
              onClick={() => {
                if (!showAdminUi) setActingRole('admin')
                onNavigate('admin')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200"
            >
              Administration
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 text-red-400 border-t border-slate-800 mt-1"
          >
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
