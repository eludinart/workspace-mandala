'use client'

import { MandalaSharePanel } from '@/components/share/MandalaSharePanel'
import {
  placePublicAbsoluteUrl,
  placePublicPath,
  placeShareText,
} from '@/lib/place-share'

export function PlaceShare({
  slug,
  placeName,
  canSharePublic,
  alwaysShow = false,
  compact = false,
  heading,
}: {
  slug: string
  placeName: string
  /** True si le profil lieu est public (`profile_public`). */
  canSharePublic: boolean
  alwaysShow?: boolean
  compact?: boolean
  heading?: string
}) {
  if (!slug.trim()) return null
  return (
    <MandalaSharePanel
      path={placePublicPath(slug)}
      absoluteUrl={placePublicAbsoluteUrl(slug)}
      heading={heading?.trim() || (alwaysShow ? 'Partager mon lieu' : 'Partager ce lieu')}
      shareTitle={placeShareText(placeName)}
      canSharePublic={canSharePublic}
      alwaysShow={alwaysShow}
      unavailableMessage="Activez « Profil du lieu public » pour partager un lien public."
      compact={compact}
    />
  )
}
