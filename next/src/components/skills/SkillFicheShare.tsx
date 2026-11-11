'use client'

import { MandalaSharePanel } from '@/components/share/MandalaSharePanel'
import {
  skillFichePublicAbsoluteUrl,
  skillFichePublicPath,
  skillFicheShareText,
} from '@/lib/skill-share'

export function SkillFicheShare({
  userId,
  displayName,
  shareTitle,
  heading,
  canSharePublic,
  compact = false,
  alwaysShow = false,
}: {
  userId: number
  displayName: string
  /** Titre natif de partage ; défaut = « Fiche Mandala de {displayName} ». */
  shareTitle?: string
  /** Libellé du bloc ; défaut selon propriétaire / lecteur. */
  heading?: string
  /** True seulement si scope === 'mandala' (page publique réelle). */
  canSharePublic: boolean
  compact?: boolean
  /**
   * Affiche le bloc même si le lien public n’est pas encore actif
   * (ex. propriétaire sur formulaire Profil / Compétences / sa fiche).
   */
  alwaysShow?: boolean
}) {
  if (!userId) return null
  return (
    <MandalaSharePanel
      path={skillFichePublicPath(userId)}
      absoluteUrl={skillFichePublicAbsoluteUrl(userId)}
      heading={heading?.trim() || (alwaysShow ? 'Partager ma fiche' : 'Partager cette fiche')}
      shareTitle={shareTitle?.trim() || skillFicheShareText(displayName)}
      canSharePublic={canSharePublic}
      alwaysShow={alwaysShow}
      unavailableMessage="Rendez la fiche visible « Tout Mandala » pour partager un lien public."
      compact={compact}
    />
  )
}
