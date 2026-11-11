'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  skillsApi,
  type AnnuaireAudience,
  type AnnuaireMapMarker,
} from '@/api/skills'
import { SkillsCarousel } from '@/components/landing/SkillsCarousel'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'
import { SkillsDirectory } from '@/components/skills/SkillsDirectory'
import { useAuth } from '@/contexts/AuthContext'
import { onMandalaMapChanged } from '@/lib/map-changed'

const AnnuaireCitiesMap = dynamic(
  () =>
    import('@/components/public/AnnuaireCitiesMap').then((m) => m.AnnuaireCitiesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(40vh,16rem)] sm:h-[min(48vh,22rem)] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

/** Page publique Annuaire Mandala — double vision + carte villes d’exercice. */
export function PublicSkillsPage() {
  const { user, loading: authLoading } = useAuth()
  const [highlightUserId, setHighlightUserId] = useState<number | null>(null)
  const [audience, setAudience] = useState<AnnuaireAudience>('all')
  const [markers, setMarkers] = useState<AnnuaireMapMarker[]>([])
  const [mapLoading, setMapLoading] = useState(true)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  const loadMap = useCallback(async () => {
    setMapLoading(true)
    try {
      const res = await skillsApi.mapMarkers({ audience })
      setMarkers(res.markers ?? [])
    } catch {
      setMarkers([])
    } finally {
      setMapLoading(false)
    }
  }, [audience])

  useEffect(() => {
    const handle = window.setTimeout(() => void loadMap(), 150)
    return () => window.clearTimeout(handle)
  }, [loadMap])

  useEffect(() => onMandalaMapChanged(() => void loadMap()), [loadMap])

  return (
    <PublicSiteChrome user={user} authLoading={authLoading}>
      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">
              Annuaire
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-slate-50">
              Annuaire Mandala
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Pros validés et membres du réseau, ancrés dans des lieux qui se font
              confiance. Filtrez Mandala Pro ou les membres ; la carte montre les
              villes d’exercice et les lieux Mandala rattachés.
            </p>
          </div>
          <SkillsCarousel
            onOpenProfile={(userId) => {
              setHighlightUserId(userId)
              document
                .getElementById('annuaire')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
          <div id="annuaire" className="scroll-mt-20 space-y-6">
            <div id="annuaire-carte" className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">
                    Carte des membres
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chaque pin est une personne × ville d’exercice. Seuls les lieux listés
                    publiquement (comme sur le mur) apparaissent en rattachement. Le filtre
                    Pros / Membres s’applique aussi ici.
                  </p>
                </div>
                {mapLoading && (
                  <p className="text-[11px] text-slate-500">Mise à jour carte…</p>
                )}
              </div>
              <AnnuaireCitiesMap
                markers={markers}
                selectedId={selectedMarkerId}
                onSelectMarker={(m) => {
                  setSelectedMarkerId(m.id)
                  if (m.kind === 'practice' && m.user_id) {
                    setHighlightUserId(m.user_id)
                    // L’ouverture popup de la fiche est déclenchée dans SkillsDirectory
                    // dès que initialUserId change.
                  }
                }}
              />
            </div>
            <SkillsDirectory
              variant="public"
              initialUserId={highlightUserId}
              audience={audience}
              onAudienceChange={(next) => {
                setAudience(next)
                setSelectedMarkerId(null)
              }}
            />
          </div>
        </section>
      </main>
    </PublicSiteChrome>
  )
}
