'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'

/**
 * Mur d'actualité + carte du réseau (espace connecté `/app`).
 * Remplace l'ancienne « Carte des lieux » par une vue unifiée découverte.
 */
export function DiscoverWallPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-400/90 font-semibold">
          Réseau Mandala
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold">Découvrir</h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Carte des lieux, événements à venir et messages des organisateurs — le fil de vie de vos
          communautés, classé par date ou par lieu.
        </p>
      </header>

      <WallDiscoverSection
        feedLimit={40}
        onEventClick={
          onNavigate
            ? (eventId) => onNavigate('events', { eventId })
            : undefined
        }
      />
    </div>
  )
}
