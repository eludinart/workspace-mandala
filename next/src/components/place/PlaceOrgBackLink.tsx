'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'

export function PlaceOrgBackLink({
  onNavigate,
  hubSlug,
  label = '← Retour au lieu',
}: {
  onNavigate: MandalaNavigate
  hubSlug: string
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate('managed-places', { managedPlaceHub: hubSlug })}
      className="text-sm text-sky-400 hover:text-sky-300"
    >
      {label}
    </button>
  )
}
