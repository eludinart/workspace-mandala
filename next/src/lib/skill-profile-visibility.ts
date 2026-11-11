/** Contenu minimal aligné sur `hasContent` dans `db-skills`. */
export type SkillProfileVisibilityInput = {
  scope: string
  offer_text?: string | null
  seek_text?: string | null
  tags?: Array<{ label?: string } | string> | null
}

export function skillProfileHasContent(profile: SkillProfileVisibilityInput): boolean {
  const tags = profile.tags ?? []
  const hasTag = tags.some((t) => {
    const label = typeof t === 'string' ? t : t.label
    return Boolean(label && String(label).trim())
  })
  return (
    hasTag ||
    Boolean(profile.offer_text?.trim()) ||
    Boolean(profile.seek_text?.trim())
  )
}

/** Visible dans l’annuaire Mandala (portée tout Mandala + contenu). */
export function isSkillProfileVisibleOnMandala(profile: SkillProfileVisibilityInput): boolean {
  return profile.scope === 'mandala' && skillProfileHasContent(profile)
}

/** Règle 1 — rappel Accueil Explorer : pas encore visible dans l’annuaire. */
export function needsExploreProfileNudge(profile: SkillProfileVisibilityInput): boolean {
  return !isSkillProfileVisibleOnMandala(profile)
}

export const EXPLORE_PROFILE_NUDGE_DISMISS_KEY = 'mdl_explore_profile_nudge_dismissed'
