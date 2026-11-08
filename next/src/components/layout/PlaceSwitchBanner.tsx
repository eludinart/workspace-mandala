'use client'

import { useCommunity } from '@/contexts/CommunityContext'

export function PlaceSwitchBanner() {
  const { placeSwitchNotice, dismissPlaceSwitch, active } = useCommunity()
  if (!placeSwitchNotice) return null

  const placeName = placeSwitchNotice.placeName
  const placeSlug = active?.name === placeName ? active.slug : null

  return (
    <div
      className="shrink-0 mx-4 md:mx-6 mt-2 rounded-xl border border-violet-400/50 bg-violet-950 px-4 py-3 flex items-start justify-between gap-3 shadow-lg shadow-violet-950/40"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0 text-sm">
        <p className="text-violet-200/90">Lieu connecté</p>
        <p className="font-semibold text-white text-base leading-snug break-words mt-0.5">
          {placeName}
        </p>
        {placeSlug && (
          <p className="text-xs text-violet-300/90 mt-0.5 truncate">/{placeSlug}</p>
        )}
        {placeSwitchNotice.reason === 'notification' && (
          <p className="text-xs text-violet-300/80 mt-1">
            Ouverture depuis une notification de message.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismissPlaceSwitch}
        className="text-violet-300 hover:text-white text-xs shrink-0 px-2 py-1 rounded-lg hover:bg-violet-900/50"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  )
}
