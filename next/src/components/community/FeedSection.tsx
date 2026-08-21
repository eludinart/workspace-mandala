'use client'

import { useEffect, useState, type ReactNode } from 'react'

type FeedSectionTone = 'amber' | 'violet' | 'slate' | 'custom'

const TONE_CLASS: Record<Exclude<FeedSectionTone, 'custom'>, string> = {
  amber: 'border-l-amber-500 bg-amber-950/25',
  violet: 'border-l-violet-500 bg-violet-950/25',
  slate: 'border-l-slate-500 bg-slate-900/50',
}

export function FeedSection({
  icon,
  title,
  subtitle,
  action,
  tone = 'slate',
  accentColor,
  collapsible = false,
  storageKey,
  defaultCollapsed = false,
  children,
}: {
  icon?: string
  title: string
  subtitle?: string
  action?: ReactNode
  tone?: FeedSectionTone
  accentColor?: string | null
  /** Affiche un bouton pour réduire / développer le contenu */
  collapsible?: boolean
  /** Persiste l’état plié dans localStorage */
  storageKey?: string
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    if (!collapsible || !storageKey || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw === '1') setCollapsed(true)
      else if (raw === '0') setCollapsed(false)
    } catch {
      /* ignore */
    }
  }, [collapsible, storageKey])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }

  const bannerClass =
    tone === 'custom' && accentColor
      ? 'bg-slate-900/50'
      : tone !== 'custom'
        ? TONE_CLASS[tone]
        : TONE_CLASS.slate

  const borderStyle =
    tone === 'custom' && accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 4 } : undefined

  return (
    <section className="rounded-2xl border border-slate-800 overflow-hidden shadow-sm shadow-black/20">
      <div
        className={`flex items-start justify-between gap-3 px-4 py-3 border-l-4 ${bannerClass}`}
        style={borderStyle}
      >
        <div className="min-w-0 flex-1">
          {collapsible ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="min-w-0 text-left w-full"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Développer la section' : 'Réduire la section'}
            >
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {icon && <span aria-hidden>{icon}</span>}
                {title}
                <span className="text-slate-500 text-sm font-normal" aria-hidden>
                  {collapsed ? '▸' : '▾'}
                </span>
              </h2>
              {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </button>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {icon && <span aria-hidden>{icon}</span>}
                {title}
              </h2>
              {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </>
          )}
        </div>
        {(action || collapsible) && (
          <div className="shrink-0 flex items-center gap-2">
            {action}
            {collapsible && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="text-sm text-slate-400 hover:text-slate-200 px-1"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Développer' : 'Réduire'}
              >
                {collapsed ? 'Développer' : 'Réduire'}
              </button>
            )}
          </div>
        )}
      </div>
      {!collapsed && <div className="p-4 space-y-3 bg-slate-950/40">{children}</div>}
    </section>
  )
}
