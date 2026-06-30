'use client'

import { useEffect, useState } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { CommunitySwitcher } from '@/components/layout/CommunitySwitcher'
import { formatCommunityRoleLabel } from '@/lib/community-role-labels'
import { PAGE_LABELS } from '@/lib/nav'

type ActivePlaceBarProps = {
  /** Titre de page courante sous le lieu (en-tête principal). */
  page?: MandalaPage
  className?: string
  /** Variante compacte pour l'en-tête mobile. */
  variant?: 'sidebar' | 'header'
}

export function ActivePlaceBar({ page, className = '', variant = 'sidebar' }: ActivePlaceBarProps) {
  const { active } = useCommunity()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const accent = active?.accent_color ?? '#7c3aed'
  const placeRole = formatCommunityRoleLabel(active?.role)

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!active?.name) {
      document.title = 'Mandala'
      return
    }
    const pagePart = page && page !== 'home' ? ` — ${PAGE_LABELS[page]}` : ''
    document.title = `${active.name}${pagePart} · Mandala`
  }, [active?.name, active?.slug, page])

  const isHeader = variant === 'header'

  return (
    <>
      <button
        type="button"
        onClick={() => setSwitcherOpen(true)}
        className={`w-full text-left rounded-xl border transition-colors ${
          isHeader
            ? 'border-transparent hover:bg-slate-900/80 px-2 py-1.5 -ml-1'
            : 'border-slate-700/80 bg-slate-900/70 hover:border-violet-500/40 p-2.5'
        } ${className}`}
        aria-label={`Lieu actif : ${active?.name ?? 'aucun'}. Changer de lieu`}
      >
        <p
          className={`uppercase tracking-widest font-semibold ${
            isHeader ? 'text-[10px] text-slate-500' : 'text-[10px] text-violet-400/90'
          }`}
        >
          Lieu actif
        </p>
        <div className={`flex items-center gap-2 min-w-0 ${isHeader ? 'mt-0.5' : 'mt-1.5'}`}>
          <CommunityAvatar
            avatar={active?.avatar}
            logoEmoji={active?.logo_emoji}
            accentColor={active?.accent_color}
            size={isHeader ? 'xs' : 'sm'}
            className={isHeader ? '!w-5 !h-5 !text-sm shrink-0' : 'shrink-0'}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`font-semibold truncate ${isHeader ? 'text-base sm:text-lg' : 'text-sm'}`}
              style={{ color: accent }}
            >
              {active?.name ?? 'Choisir un lieu'}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              {active ? (
                <>
                  {placeRole}
                  {active.slug ? ` · ${active.slug}` : ''}
                </>
              ) : (
                'Sélectionnez une communauté'
              )}
            </p>
          </div>
          <span className="text-slate-500 shrink-0 text-xs" aria-hidden>
            ▾
          </span>
        </div>
        {page && page !== 'admin' && isHeader && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate pl-7 sm:pl-8">
            {PAGE_LABELS[page]}
          </p>
        )}
      </button>
      <CommunitySwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </>
  )
}
