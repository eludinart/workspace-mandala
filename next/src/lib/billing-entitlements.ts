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

/** Plafond freemium lieux non abonnés (stock permanent). Spec 2026-11-05. */
export const PLACE_FREE_MEMBER_CAP = 40
/** Soft warning à 80 % du plafond. */
export const PLACE_FREE_MEMBER_SOFT_AT = 32
export const PLACE_MEMBER_CAP_REACHED_CODE = 'place_member_cap_reached'

export const PLACE_MEMBER_CAP_REACHED_MESSAGE =
  'Ce lieu a atteint la limite de 40 membres en gratuit. Souscrivez à l’offre Lieu pour accueillir sans plafond et figurer sur la carte publique.'

export type PlaceMemberCapState = 'ok' | 'soft' | 'hard'

export type EntitlementFlags = {
  isAppAdmin: boolean
  billingPublic: boolean
  placeActive: boolean
  proActive: boolean
  proVerified: boolean
  memberCovered: boolean
}

export function placeMemberCapState(opts: {
  billingPublic: boolean
  placeActive: boolean
  memberCount: number
}): PlaceMemberCapState {
  if (!opts.billingPublic || opts.placeActive) return 'ok'
  const n = Math.max(0, Math.floor(Number(opts.memberCount) || 0))
  if (n >= PLACE_FREE_MEMBER_CAP) return 'hard'
  if (n >= PLACE_FREE_MEMBER_SOFT_AT) return 'soft'
  return 'ok'
}

/** true si une nouvelle adhésion est autorisée (pas encore au plafond). */
export function canAcceptNewPlaceMember(opts: {
  billingPublic: boolean
  placeActive: boolean
  isAppAdmin: boolean
  memberCount: number
}): boolean {
  if (opts.isAppAdmin) return true
  return (
    placeMemberCapState({
      billingPublic: opts.billingPublic,
      placeActive: opts.placeActive,
      memberCount: opts.memberCount,
    }) !== 'hard'
  )
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
