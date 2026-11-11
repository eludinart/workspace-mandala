'use client'

import { MandalaSharePanel } from '@/components/share/MandalaSharePanel'
import {
  resourcePublicAbsoluteUrl,
  resourcePublicPath,
  resourceShareText,
} from '@/lib/resource-share'

export function ResourceShare({
  resourceId,
  title,
  canSharePublic,
  alwaysShow = false,
  compact = false,
  heading,
}: {
  resourceId: number
  title: string
  /** True si scope === 'mandala'. */
  canSharePublic: boolean
  alwaysShow?: boolean
  compact?: boolean
  heading?: string
}) {
  if (!resourceId) return null
  return (
    <MandalaSharePanel
      path={resourcePublicPath(resourceId)}
      absoluteUrl={resourcePublicAbsoluteUrl(resourceId)}
      heading={heading?.trim() || (alwaysShow ? 'Partager ma ressource' : 'Partager cette ressource')}
      shareTitle={resourceShareText(title)}
      canSharePublic={canSharePublic}
      alwaysShow={alwaysShow}
      unavailableMessage="Passez la ressource en « Tout Mandala » pour partager un lien public."
      compact={compact}
    />
  )
}
