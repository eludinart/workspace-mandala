'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'
import { ThemePicker } from '@/components/theme/ThemePicker'

function scrollLandingTo(from: HTMLElement, id: string) {
  const scroller = from.closest('.m-landing')?.querySelector(':scope > .overflow-y-auto')
  if (id === 'top') {
    if (scroller instanceof HTMLElement) scroller.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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
  const pathname = usePathname()
  const onLandingAnchor = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    if (pathname !== '/') return
    event.preventDefault()
    scrollLandingTo(event.currentTarget, id)
  }
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
          <a
            href="/#top"
            aria-current={pathname === '/' ? 'page' : undefined}
            onClick={(event) => onLandingAnchor(event, 'top')}
          >
            Accueil
          </a>
          <a href="/#mur" onClick={(event) => onLandingAnchor(event, 'mur')}>
            Mur &amp; carte
          </a>
          <Link href="/competences" aria-current={pathname === '/competences' ? 'page' : undefined}>
            Compétences
          </Link>
          <Link href="/ressources" aria-current={pathname === '/ressources' ? 'page' : undefined}>
            Ressources
          </Link>
          <a href="/#projet" onClick={(event) => onLandingAnchor(event, 'projet')}>
            Le projet
          </a>
          <a href="/#lieux" onClick={(event) => onLandingAnchor(event, 'lieux')}>
            Lieux
          </a>
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
