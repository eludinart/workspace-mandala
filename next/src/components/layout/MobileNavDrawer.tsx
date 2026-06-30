'use client'

import { useEffect } from 'react'
import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import { AppNavPanel } from '@/components/layout/AppNavPanel'

export function MobileNavDrawer({
  open,
  onClose,
  page,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  page: MandalaPage
  onNavigate: MandalaNavigate
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu de navigation">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 w-[min(100vw-3rem,18rem)] bg-slate-950 border-r border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 shrink-0">
          <p className="text-sm font-semibold text-slate-200">Menu</p>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <AppNavPanel
            page={page}
            onNavigate={onNavigate}
            onItemClick={onClose}
            showBranding={false}
          />
        </div>
      </aside>
    </div>
  )
}
