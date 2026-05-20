'use client'

const COLORS: Record<string, string> = {
  calm: 'bg-emerald-400/80',
  vibrant: 'bg-amber-400/80',
  tense: 'bg-amber-500/90',
  breach: 'bg-rose-500/90',
}

export function TemperatureIndicator({
  temperature = 'calm',
  className = '',
}: {
  temperature?: string
  className?: string
}) {
  const color = COLORS[temperature] || COLORS.calm
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} shadow-sm ${className}`}
      title={temperature}
      aria-hidden
    />
  )
}
