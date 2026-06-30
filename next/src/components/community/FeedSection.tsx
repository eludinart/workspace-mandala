'use client'

import type { ReactNode } from 'react'

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
  children,
}: {
  icon?: string
  title: string
  subtitle?: string
  action?: ReactNode
  tone?: FeedSectionTone
  accentColor?: string | null
  children: ReactNode
}) {
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
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            {icon && <span aria-hidden>{icon}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4 space-y-3 bg-slate-950/40">{children}</div>
    </section>
  )
}
