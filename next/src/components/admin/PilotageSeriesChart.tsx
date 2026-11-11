'use client'

import { useRef } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PilotageSeriesMetric } from '@/lib/db-admin-pilotage-drill'

export type PilotageSeriesPoint = {
  day: string
  registrations: number
  joins: number
  dau: number
}

const COLORS = {
  registrations: '#059669',
  joins: '#0284c7',
  dau: '#7c3aed',
} as const

type Props = {
  series: PilotageSeriesPoint[]
  onSelectDay: (day: string, metric: PilotageSeriesMetric) => void
  height?: number
}

function dayLabel(day: string): string {
  return day.length >= 10 ? day.slice(5) : day
}

export function PilotageSeriesChart({ series, onSelectDay, height = 260 }: Props) {
  const metricRef = useRef<PilotageSeriesMetric>('registrations')
  const data = series.map((s) => ({
    ...s,
    label: dayLabel(s.day),
  }))

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-2 pt-3 pb-1">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
          onClick={(state) => {
            const payload = state?.activePayload?.[0]?.payload as PilotageSeriesPoint | undefined
            if (!payload?.day) return
            onSelectDay(payload.day, metricRef.current)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={32}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#cbd5e1' }}
            labelFormatter={(_, payload) => {
              const day = (payload?.[0]?.payload as PilotageSeriesPoint | undefined)?.day
              return day ? String(day) : ''
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                registrations: 'Inscriptions',
                joins: 'Rejoins',
                dau: 'Actifs',
              }
              return [value, labels[name] ?? name]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            formatter={(value) => {
              const labels: Record<string, string> = {
                registrations: 'Inscriptions',
                joins: 'Rejoins',
                dau: 'Actifs',
              }
              return labels[value] ?? value
            }}
          />
          <Line
            type="monotone"
            dataKey="registrations"
            name="registrations"
            stroke={COLORS.registrations}
            strokeWidth={2}
            dot={{ r: 3, cursor: 'pointer' }}
            activeDot={{ r: 5, cursor: 'pointer' }}
            onMouseEnter={() => {
              metricRef.current = 'registrations'
            }}
          />
          <Line
            type="monotone"
            dataKey="joins"
            name="joins"
            stroke={COLORS.joins}
            strokeWidth={2}
            dot={{ r: 3, cursor: 'pointer' }}
            activeDot={{ r: 5, cursor: 'pointer' }}
            onMouseEnter={() => {
              metricRef.current = 'joins'
            }}
          />
          <Line
            type="monotone"
            dataKey="dau"
            name="dau"
            stroke={COLORS.dau}
            strokeWidth={2}
            dot={{ r: 3, cursor: 'pointer' }}
            activeDot={{ r: 5, cursor: 'pointer' }}
            onMouseEnter={() => {
              metricRef.current = 'dau'
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
