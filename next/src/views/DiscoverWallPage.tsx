'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'
import { SkillsCarousel } from '@/components/landing/SkillsCarousel'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'
import { OPEN_SKILL_USER_KEY, queueSkillFiche } from '@/components/skills/SkillsDirectory'

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

      {onNavigate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('skills')}
            className="m-landing-icon-card hover:opacity-90 transition-opacity text-left w-full"
          >
            <div className="m-landing-icon-mark" aria-hidden>
              ✨
            </div>
            <h2 className="text-xl mb-1">Compétences</h2>
            <p className="text-sm text-slate-400 leading-relaxed">Annuaire des savoir-faire</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('resources')}
            className="m-landing-icon-card hover:opacity-90 transition-opacity text-left w-full"
          >
            <div className="m-landing-icon-mark" aria-hidden>
              📚
            </div>
            <h2 className="text-xl mb-1">Ressources</h2>
            <p className="text-sm text-slate-400 leading-relaxed">Recettes, textes, vidéos et documents</p>
          </button>
        </div>
      )}

      <SkillsCarousel
        onOpenProfile={
          onNavigate
            ? (userId) => {
                queueSkillFiche(userId)
                onNavigate('skills')
              }
            : undefined
        }
      />

      <WallDiscoverSection
        feedLimit={40}
        onEventClick={
          onNavigate
            ? (eventId) => onNavigate('events', { eventId })
            : undefined
        }
        onOpenProfile={
          onNavigate
            ? (userId) => {
                sessionStorage.setItem(OPEN_SKILL_USER_KEY, String(userId))
                onNavigate('skills')
              }
            : undefined
        }
      />
    </div>
  )
}
