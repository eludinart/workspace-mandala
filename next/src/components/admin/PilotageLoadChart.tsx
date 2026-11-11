'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type PilotageLoadPoint = {
  at: number
  rps: number
  avgMs: number
  errors: number
}

type Props = {
  series: PilotageLoadPoint[]
  onOpenLoad?: () => void
  height?: number
}

function formatAt(at: number): string {
  try {
    return new Date(at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function PilotageLoadChart({ series, onOpenLoad, height = 180 }: Props) {
  const data = series.map((s) => ({
    ...s,
    label: formatAt(s.at),
  }))

  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-950/40 px-2 pt-3 pb-1 text-left hover:border-violet-600/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
      onClick={() => onOpenLoad?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenLoad?.()
        }
      }}
      title="Ouvrir Charge & alertes"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(124, 58, 237, 0.08)' }}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(value: number, name: string) => {
              if (name === 'rps') return [value, 'RPS']
              if (name === 'avgMs') return [`${value} ms`, 'Latence moy.']
              if (name === 'errors') return [value, 'Erreurs']
              return [value, name]
            }}
          />
          <Bar dataKey="rps" name="rps" fill="#64748b" radius={[2, 2, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
