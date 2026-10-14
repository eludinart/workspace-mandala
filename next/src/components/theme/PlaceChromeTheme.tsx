'use client'

import { useEffect } from 'react'
import { useCommunity } from '@/contexts/CommunityContext'
import { useTheme } from '@/contexts/ThemeContext'

/** Peint toute l’interface avec la couleur du lieu actif. */
export function PlaceChromeTheme() {
  const { communities, active, loading } = useCommunity()
  const { syncActivePlaceTheme } = useTheme()

  useEffect(() => {
    syncActivePlaceTheme(
      loading,
      communities.map((place) => ({ slug: place.slug, accent_color: place.accent_color })),
      active?.slug ?? null,
    )
  }, [active?.slug, communities, loading, syncActivePlaceTheme])

  useEffect(() => () => syncActivePlaceTheme(false, [], null), [syncActivePlaceTheme])

  return null
}
