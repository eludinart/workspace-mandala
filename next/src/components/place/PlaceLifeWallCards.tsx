'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { placeListsApi } from '@/api/place-ops'
import { FeedSection } from '@/components/community/FeedSection'

type Summary = {
  courses_count: number
  logistics_count: number
  courses_preview: Array<{ id: number; title: string; bring_date: string | null }>
  logistics_preview: Array<{ id: number; title: string; bring_date: string | null }>
  latest_circle: { day: string; slot: 'morning' | 'evening'; has_image: boolean } | null
}

const EMPTY: Summary = {
  courses_count: 0,
  logistics_count: 0,
  courses_preview: [],
  logistics_preview: [],
  latest_circle: null,
}

export function PlaceLifeWallCards({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { active } = useCommunity()
  const [summary, setSummary] = useState<Summary>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setFailed(false)
    try {
      const data = (await placeListsApi.summary(active.slug)) as Summary
      setSummary({
        courses_count: data.courses_count ?? 0,
        logistics_count: data.logistics_count ?? 0,
        courses_preview: data.courses_preview ?? [],
        logistics_preview: data.logistics_preview ?? [],
        latest_circle: data.latest_circle ?? null,
      })
    } catch {
      setSummary(EMPTY)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void load()
  }, [load])

  if (!active) return null

  const accent = active.accent_color ?? '#7c3aed'
  const slotLabel = summary.latest_circle?.slot === 'morning' ? 'matin' : 'soir'

  return (
    <FeedSection
      icon="🌿"
      title="Vie du lieu"
      subtitle="Courses, logistique et cercles"
      tone="custom"
      accentColor={accent}
    >
      {loading && <p className="text-sm text-slate-500">Chargement…</p>}
      {failed && !loading && (
        <p className="text-sm text-amber-200/90">
          Impossible de charger le résumé — ouvrez Courses / Logistique / Cercles dans le menu.
        </p>
      )}
      {!loading && (
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigate('courses')}
            className="text-left rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 hover:border-slate-600 transition-colors"
          >
            <p className="text-sm font-semibold text-slate-100">🛒 Courses</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {summary.courses_count === 0
                ? 'Rien à apporter pour l’instant'
                : `${summary.courses_count} besoin${summary.courses_count > 1 ? 's' : ''}`}
            </p>
            {summary.courses_preview[0] && (
              <p className="text-[11px] text-slate-500 mt-2 truncate">{summary.courses_preview[0].title}</p>
            )}
            <p className="text-[11px] mt-2 font-medium" style={{ color: accent }}>
              Voir →
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('logistics')}
            className="text-left rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 hover:border-slate-600 transition-colors"
          >
            <p className="text-sm font-semibold text-slate-100">🧰 Logistique</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {summary.logistics_count === 0
                ? 'Aucun besoin en cours'
                : `${summary.logistics_count} besoin${summary.logistics_count > 1 ? 's' : ''}`}
            </p>
            {summary.logistics_preview[0] && (
              <p className="text-[11px] text-slate-500 mt-2 truncate">
                {summary.logistics_preview[0].title}
              </p>
            )}
            <p className="text-[11px] mt-2 font-medium" style={{ color: accent }}>
              Voir →
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('circles')}
            className="text-left rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 hover:border-slate-600 transition-colors"
          >
            <p className="text-sm font-semibold text-slate-100">🔄 Cercles</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {summary.latest_circle
                ? `${summary.latest_circle.day} · ${slotLabel}`
                : 'Pas encore de cercle ce mois'}
            </p>
            {summary.latest_circle?.has_image && (
              <p className="text-[11px] text-slate-500 mt-2">Photo du tableau dispo</p>
            )}
            <p className="text-[11px] mt-2 font-medium" style={{ color: accent }}>
              Voir →
            </p>
          </button>
        </div>
      )}
    </FeedSection>
  )
}
