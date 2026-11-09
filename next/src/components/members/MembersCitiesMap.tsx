'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { AnnuaireMapMarker } from '@/api/skills'
import { api } from '@/lib/api-client'
import { useFeatureDoors } from '@/hooks/useFeatureDoors'
import { onMandalaMapChanged } from '@/lib/map-changed'

const AnnuaireCitiesMap = dynamic(
  () =>
    import('@/components/public/AnnuaireCitiesMap').then((m) => m.AnnuaireCitiesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(40vh,16rem)] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

export function MembersCitiesMap({ communitySlug }: { communitySlug?: string }) {
  const { can, loading: doorsLoading } = useFeatureDoors()
  const [markers, setMarkers] = useState<AnnuaireMapMarker[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (doorsLoading || !can('carte_membres') || !communitySlug) {
      setMarkers([])
      return
    }
    let cancelled = false
    const loadMarkers = () => {
      setLoading(true)
      void api
        .get(`/api/members/city?community_slug=${encodeURIComponent(communitySlug)}`)
        .then((raw) => {
          if (cancelled) return
          const data = raw as { markers?: AnnuaireMapMarker[]; pins?: AnnuaireMapMarker[] }
          setMarkers(data.markers ?? [])
        })
        .catch(() => {
          if (!cancelled) setMarkers([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    loadMarkers()
    const off = onMandalaMapChanged(loadMarkers)
    return () => {
      cancelled = true
      off()
    }
  }, [can, doorsLoading, communitySlug])

  if (doorsLoading || !can('carte_membres') || !communitySlug) return null

  const peopleCount = new Set(
    markers
      .filter((m) => m.kind === 'practice' || m.kind === 'residence')
      .map((m) => m.user_id)
      .filter((id): id is number => typeof id === 'number' && id > 0)
  ).size

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Carte des membres</h3>
          <p className="text-xs text-slate-500">
            Lieux d’exercice (plusieurs points possibles) des personnes qui ont accepté
            d’apparaître · {peopleCount} personne{peopleCount === 1 ? '' : 's'}
            {markers.length > peopleCount ? ` · ${markers.length} points` : ''}.
          </p>
        </div>
        {loading && <p className="text-[11px] text-slate-500">Mise à jour carte…</p>}
      </div>
      <AnnuaireCitiesMap
        markers={markers}
        heightClassName="h-[min(40vh,16rem)]"
        hideCaption
      />
    </section>
  )
}
