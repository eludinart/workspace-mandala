'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useState, type MouseEvent, type ReactNode } from 'react'
import { ThemePicker } from '@/components/theme/ThemePicker'
import {
  consumeStashedLandingHash,
  isLandingSectionId,
  readWindowLandingHash,
  scheduleLandingScroll,
  scrollLandingToId,
  stashLandingHash,
} from '@/lib/landing-scroll'

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

function resolveLandingTarget(id: string): string {
  return isLandingSectionId(id) ? id : 'top'
}

type LandingNavItem =
  | { kind: 'anchor'; id: string; label: string }
  | { kind: 'route'; href: string; label: string; match?: string }

const LANDING_NAV: LandingNavItem[] = [
  { kind: 'anchor', id: 'top', label: 'Accueil' },
  { kind: 'anchor', id: 'mur', label: 'Mur & carte' },
  { kind: 'route', href: '/competences', label: 'Annuaire', match: '/competences' },
  { kind: 'route', href: '/ressources', label: 'Ressources', match: '/ressources' },
  { kind: 'anchor', id: 'projet', label: 'Le projet' },
  { kind: 'anchor', id: 'tarifs', label: 'Offres' },
  { kind: 'anchor', id: 'lieux', label: 'Lieux' },
]

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
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileMenuOpen])

  useEffect(() => {
    if (pathname !== '/') return

    const applyHash = (raw: string | null, behavior: ScrollBehavior = 'smooth') => {
      if (!raw) return
      const id = resolveLandingTarget(raw)
      scheduleLandingScroll(id, behavior)
    }

    const pending = consumeStashedLandingHash()
    applyHash(pending ?? readWindowLandingHash(), pending ? 'auto' : 'smooth')

    const onHashChange = () => applyHash(readWindowLandingHash(), 'smooth')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [pathname])

  const onLandingAnchor = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    const target = resolveLandingTarget(id)
    setMobileMenuOpen(false)

    if (pathname === '/') {
      if (typeof window !== 'undefined') {
        const next = target === 'top' ? '/' : `/#${target}`
        window.history.replaceState(null, '', next)
      }
      scrollLandingToId(target, 'smooth')
      return
    }

    stashLandingHash(target)
    router.push(target === 'top' ? '/' : `/#${target}`)
  }

  const renderNavItem = (item: LandingNavItem) => {
    if (item.kind === 'anchor') {
      return (
        <a
          key={item.id}
          href={item.id === 'top' ? '/#top' : `/#${item.id}`}
          aria-current={item.id === 'top' && pathname === '/' ? 'page' : undefined}
          onClick={(event) => onLandingAnchor(event, item.id)}
        >
          {item.label}
        </a>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={pathname === item.match ? 'page' : undefined}
        onClick={() => setMobileMenuOpen(false)}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <div className="m-landing flex-1 h-full min-h-0 flex flex-col bg-slate-950 text-slate-100">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth pb-[env(safe-area-inset-bottom,0px)]">
        <div className="m-landing-top sticky top-0 z-[80] shadow-md shadow-black/20 overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
            <div className="justify-self-start flex items-center gap-1 min-w-0">
              <button
                type="button"
                className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:bg-slate-800/70"
                aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls={menuId}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                {mobileMenuOpen ? (
                  <span className="text-lg leading-none" aria-hidden>
                    ✕
                  </span>
                ) : (
                  <span className="flex flex-col gap-1 w-5" aria-hidden>
                    <span className="block h-0.5 w-full rounded-full bg-current" />
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                    <span className="block h-0.5 w-full rounded-full bg-current" />
                  </span>
                )}
              </button>
              <div className="hidden md:block">
                <ThemePicker />
              </div>
            </div>
            <MandalaMark className="max-w-[11rem] sm:max-w-none" />
            <div className="justify-self-end min-w-0">
              {!authLoading && user ? (
                <Link href="/app" className="m-landing-btn !py-2 !px-3 sm:!py-2.5 sm:!px-4 text-[10px]">
                  Mon espace
                </Link>
              ) : (
                <Link
                  href="/app"
                  className="inline-flex rounded-full border border-slate-700/70 px-3 py-2 sm:px-4 sm:py-2.5 text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.16em] text-slate-300 hover:bg-slate-800/70"
                >
                  Connexion
                </Link>
              )}
            </div>
          </div>

          <nav className="m-landing-nav hidden md:block" aria-label="Sections du site">
            <div className="max-w-6xl mx-auto px-2 sm:px-6 flex items-center justify-center gap-1 sm:gap-4">
              {LANDING_NAV.map(renderNavItem)}
              {!user && <Link href="/app?mode=register">Rejoindre</Link>}
            </div>
          </nav>

          {mobileMenuOpen && (
            <nav
              id={menuId}
              className="m-landing-nav md:hidden border-t border-white/10"
              aria-label="Sections du site"
            >
              <div className="max-w-6xl mx-auto px-3 py-2 flex flex-col">
                {LANDING_NAV.map(renderNavItem)}
                {!user && (
                  <Link href="/app?mode=register" onClick={() => setMobileMenuOpen(false)}>
                    Rejoindre
                  </Link>
                )}
                <div className="flex items-center justify-between gap-3 px-2 py-3 border-t border-white/10 mt-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/70">Apparence</span>
                  <ThemePicker />
                </div>
              </div>
            </nav>
          )}
        </div>

        {children}
      </div>
    </div>
  )
}
