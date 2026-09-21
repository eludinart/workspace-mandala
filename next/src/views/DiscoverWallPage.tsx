'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'

/**
 * Mur d'actualité + carte du réseau (espace connecté `/app`).
 * Remplace l'ancienne « Carte des lieux » par une vue unifiée découverte.
 */
export function DiscoverWallPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  return (
    <div className="m-landing w-full space-y-8 pb-8">
      <header className="text-center sm:text-left space-y-3 pt-1">
        <p className="m-landing-eyebrow">Réseau Mandala</p>
        <h1 className="m-landing-hero-title !text-4xl sm:!text-5xl">Découvrir</h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed sm:mx-0 mx-auto">
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
