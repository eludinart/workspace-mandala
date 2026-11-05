/**
 * Résolution d’accès Lieu / Mandala Pro.
 */
import {
  PLACE_FREE_MEMBER_CAP,
  PLACE_FREE_MEMBER_SOFT_AT,
  PLACE_MEMBER_CAP_REACHED_CODE,
  PLACE_MEMBER_CAP_REACHED_MESSAGE,
  canAcceptNewPlaceMember,
  canAccessFeature,
  placeMemberCapState,
  type EntitlementFlags,
  type PlaceMemberCapState,
} from '@/lib/billing-entitlements'
import { isBillingPublic } from '@/lib/billing-door'
import {
  countCommunityMembers,
  getActivePlaceSubscription,
  getActiveProSubscription,
  getCommunityBillingFlags,
  getProProfile,
  isActiveSubStatus,
  userMemberOfCoveredPlace,
  type ProVerification,
} from '@/lib/db-billing'

export type SubStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'

export type PlaceMemberCapInfo = {
  enforced: boolean
  limit: number | null
  softAt: number | null
  count: number
  state: PlaceMemberCapState
}

export type PlaceBilling = {
  communityId: number
  status: SubStatus
  planId: 'place_monthly' | 'place_yearly' | 'partner' | null
  currentPeriodEnd: string | null
  coveredMemberCount: number
  featured: boolean
  partner: boolean
  memberCap: PlaceMemberCapInfo
}

function buildMemberCapInfo(opts: {
  placeActive: boolean
  memberCount: number
}): PlaceMemberCapInfo {
  const billingPublic = isBillingPublic()
  const state = placeMemberCapState({
    billingPublic,
    placeActive: opts.placeActive,
    memberCount: opts.memberCount,
  })
  const enforced = billingPublic && !opts.placeActive
  return {
    enforced,
    limit: enforced ? PLACE_FREE_MEMBER_CAP : null,
    softAt: enforced ? PLACE_FREE_MEMBER_SOFT_AT : null,
    count: opts.memberCount,
    state,
  }
}

export type ProBilling = {
  status: SubStatus
  planId: 'pro_monthly' | 'pro_yearly' | null
  verification: ProVerification
  currentPeriodEnd: string | null
  tagline: string | null
  modalities: string | null
  service_area: string | null
  external_url: string | null
}

function asSubStatus(raw: string | null | undefined): SubStatus {
  const s = String(raw ?? 'none').toLowerCase()
  if (
    s === 'trialing' ||
    s === 'active' ||
    s === 'past_due' ||
    s === 'canceled' ||
    s === 'unpaid'
  ) {
    return s
  }
  return 'none'
}

function isoOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

export async function resolvePlaceBilling(communityId: number): Promise<PlaceBilling> {
  const flags = await getCommunityBillingFlags(communityId)
  const partner = Boolean(flags?.billing_partner)
  const sub = await getActivePlaceSubscription(communityId)
  const coveredMemberCount = await countCommunityMembers(communityId)

  if (partner && !sub) {
    return {
      communityId,
      status: 'active',
      planId: 'partner',
      currentPeriodEnd: null,
      coveredMemberCount,
      featured: true,
      partner: true,
      memberCap: buildMemberCapInfo({
        placeActive: true,
        memberCount: coveredMemberCount,
      }),
    }
  }

  const status = asSubStatus(sub?.status)
  const planRaw = sub?.plan_id ?? null
  const planId =
    planRaw === 'place_monthly' || planRaw === 'place_yearly' ? planRaw : sub ? null : null

  const active = partner || isActiveSubStatus(status)
  return {
    communityId,
    status: partner && !sub ? 'active' : status,
    planId: partner && !sub ? 'partner' : planId,
    currentPeriodEnd: isoOrNull(sub?.current_period_end ?? null),
    coveredMemberCount,
    featured: active || Boolean(flags?.billing_featured),
    partner,
    memberCap: buildMemberCapInfo({
      placeActive: active,
      memberCount: coveredMemberCount,
    }),
  }
}

export async function resolveProBilling(userId: number): Promise<ProBilling> {
  const sub = await getActiveProSubscription(userId)
  const profile = await getProProfile(userId)
  const status = asSubStatus(sub?.status)
  const planRaw = sub?.plan_id ?? null
  const planId =
    planRaw === 'pro_monthly' || planRaw === 'pro_yearly' ? planRaw : null

  return {
    status: sub ? status : 'none',
    planId,
    verification: profile?.verification ?? 'none',
    currentPeriodEnd: isoOrNull(sub?.current_period_end ?? null),
    tagline: profile?.tagline ?? null,
    modalities: profile?.modalities ?? null,
    service_area: profile?.service_area ?? null,
    external_url: profile?.external_url ?? null,
  }
}

export async function userHasPlaceCoveredFree(userId: number): Promise<boolean> {
  return userMemberOfCoveredPlace(userId)
}

export async function buildEntitlementFlags(opts: {
  userId: number
  communityId?: number
  isAppAdmin: boolean
}): Promise<EntitlementFlags> {
  const [pro, memberCovered, place] = await Promise.all([
    resolveProBilling(opts.userId),
    userHasPlaceCoveredFree(opts.userId),
    opts.communityId != null
      ? resolvePlaceBilling(opts.communityId)
      : Promise.resolve(null),
  ])

  const placeActive =
    place != null &&
    (place.partner || place.status === 'active' || place.status === 'trialing')

  return {
    isAppAdmin: opts.isAppAdmin,
    billingPublic: isBillingPublic(),
    placeActive,
    proActive: pro.status === 'active' || pro.status === 'trialing',
    proVerified: pro.verification === 'verified',
    memberCovered,
  }
}

/**
 * Gate catalogue public.
 * Porte billing fermée → pas de changement (comportement actuel).
 * Porte ouverte → plan Lieu, partner ou admin requis.
 */
export async function assertCanListPlacePublic(
  communityId: number,
  isAppAdmin: boolean
): Promise<void> {
  if (isAppAdmin) return
  if (!isBillingPublic()) return
  const place = await resolvePlaceBilling(communityId)
  const placeActive =
    place.partner || place.status === 'active' || place.status === 'trialing'
  const placeFlags: EntitlementFlags = {
    isAppAdmin: false,
    billingPublic: true,
    placeActive,
    proActive: false,
    proVerified: false,
    memberCovered: false,
  }
  if (!canAccessFeature(placeFlags, 'place_listed_public')) {
    throw Object.assign(
      new Error('L’offre Lieu est requise pour publier ce lieu au catalogue'),
      { status: 403 }
    )
  }
}

/**
 * Gate freemium : refuse une nouvelle adhésion si le lieu non abonné est au plafond.
 * Porte billing fermée → no-op. Offre Lieu / partner / admin → illimité.
 * Ne retire jamais de membres existants.
 */
export async function assertCanAcceptNewPlaceMember(
  communityId: number,
  isAppAdmin: boolean
): Promise<void> {
  if (isAppAdmin) return
  if (!isBillingPublic()) return
  const place = await resolvePlaceBilling(communityId)
  const placeActive =
    place.partner || place.status === 'active' || place.status === 'trialing'
  if (
    canAcceptNewPlaceMember({
      billingPublic: true,
      placeActive,
      isAppAdmin: false,
      memberCount: place.coveredMemberCount,
    })
  ) {
    return
  }
  throw Object.assign(new Error(PLACE_MEMBER_CAP_REACHED_MESSAGE), {
    status: 403,
    code: PLACE_MEMBER_CAP_REACHED_CODE,
  })
}
