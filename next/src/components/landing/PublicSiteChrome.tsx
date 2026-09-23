'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemePicker } from '@/components/theme/ThemePicker'

export function MandalaMark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex flex-col items-center gap-1 shrink-0 ${className}`}>
      <span className="text-2xl sm:text-3xl leading-none text-slate-400/70" aria-hidden>
        ॐ
      </span>
      <span className="m-landing-logo text-slate-200">Mandala</span>
    </Link>
  )
}

export function PublicSiteChrome({
  user,
  authLoading,
  children,
}: {
  user: unknown
  authLoading?: boolean
  children: ReactNode
}) {
  return (
    <div className="m-landing flex-1 h-full min-h-0 flex flex-col bg-slate-950 text-slate-100">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth pb-[env(safe-area-inset-bottom,0px)]">
      <div className="m-landing-top relative z-[60]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="justify-self-start">
            <ThemePicker />
          </div>
          <MandalaMark />
          <div className="justify-self-end">
            {!authLoading && user ? (
              <Link href="/app" className="m-landing-btn !py-2.5 !px-4 text-[10px]">
                Mon espace
              </Link>
            ) : (
              <Link
                href="/app"
                className="hidden sm:inline-flex rounded-full border border-slate-700/70 px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-slate-300 hover:bg-slate-800/70"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </div>

      <nav className="m-landing-nav sticky top-0 z-40 shadow-md shadow-black/20">
        <div className="max-w-6xl mx-auto px-2 sm:px-6 flex items-center justify-center gap-1 sm:gap-4 overflow-x-auto">
          <a href="/#top">Accueil</a>
          <a href="/#mur">Mur &amp; carte</a>
          <a href="/#projet">Le projet</a>
          <a href="/#lieux">Lieux</a>
          {!user && (
            <Link href="/app?mode=register">Rejoindre</Link>
          )}
        </div>
      </nav>

      {children}
      </div>
    </div>
  )
}
