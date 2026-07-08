'use client'

import { useCommunity } from '@/contexts/CommunityContext'

export function PlaceSwitchBanner() {
  const { placeSwitchNotice, dismissPlaceSwitch } = useCommunity()
  if (!placeSwitchNotice) return null

  return (
    <div
      className="shrink-0 mx-4 md:mx-6 mt-2 rounded-xl border border-violet-500/35 bg-violet-950/50 px-4 py-2.5 flex items-start justify-between gap-3 shadow-lg shadow-violet-950/30"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-violet-100">
        <span className="font-medium">Lieu changé</span>
        <span className="text-violet-200/90"> — vous consultez maintenant </span>
        <span className="font-semibold text-white">{placeSwitchNotice.placeName}</span>
        {placeSwitchNotice.reason === 'notification' && (
          <span className="block text-xs text-violet-300/80 mt-0.5">
            Ouverture depuis une notification de message.
          </span>
        )}
      </p>
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
