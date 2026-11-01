/**
 * Matrice d’entitlements Mandala (Lieu / Mandala Pro) — pure, testable.
 */
export type FeatureKey =
  | 'social_core'
  | 'skills_basic'
  | 'place_listed_public'
  | 'place_catalog_boost'
  | 'place_member_cover'
  | 'pro_badge'
  | 'pro_skills_boost'
  | 'pro_contact_cta'
  | 'billing_cta'

export type EntitlementFlags = {
  isAppAdmin: boolean
  billingPublic: boolean
  placeActive: boolean
  proActive: boolean
  proVerified: boolean
  memberCovered: boolean
}

export function canAccessFeature(
  flags: EntitlementFlags,
  key: FeatureKey
): boolean {
  switch (key) {
    case 'social_core':
    case 'skills_basic':
      return true
    case 'billing_cta':
      return flags.billingPublic || flags.isAppAdmin
    case 'place_listed_public':
    case 'place_catalog_boost':
    case 'place_member_cover':
      return flags.placeActive
    case 'pro_skills_boost':
    case 'pro_contact_cta':
      return flags.proActive
    case 'pro_badge':
      return flags.proActive && flags.proVerified
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

/** Tri décroissant : boost Mandala Pro d’abord, puis label. */
export function compareSkillBoost(
  a: { proBoost: boolean; label: string },
  b: { proBoost: boolean; label: string }
): number {
  if (a.proBoost !== b.proBoost) return a.proBoost ? -1 : 1
  return a.label.localeCompare(b.label, 'fr')
}
