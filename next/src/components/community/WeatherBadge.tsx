'use client'

import { weatherOption } from '@/lib/weather-status'

export function WeatherBadge({
  status,
  note,
  size = 'sm',
}: {
  status: string | null | undefined
  note?: string | null
  size?: 'sm' | 'md'
}) {
  const opt = weatherOption(status)
  if (!opt) return null
  const dot = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0"
      title={note ? `${opt.label} — ${note}` : opt.label}
    >
      <span className={`rounded-full ${dot} ${opt.dotClass}`} aria-hidden />
      <span className={size === 'md' ? 'text-base' : 'text-sm'} aria-hidden>
        {opt.emoji}
      </span>
    </span>
  )
}
