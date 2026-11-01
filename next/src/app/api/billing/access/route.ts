/**
 * GET /api/billing/access
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isBillingPublic } from '@/lib/billing-door'
import {
  resolvePlaceBilling,
  resolveProBilling,
  userHasPlaceCoveredFree,
} from '@/lib/billing-access'
import {
  listManagedCommunityIds,
  listPlaceSubscriptionsForUser,
} from '@/lib/db-billing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    let isAdmin = false
    try {
      const user = await authMe(uid)
      const role = String(user.app_role || user.wp_role || '').toLowerCase()
      isAdmin = role === 'admin' || role === 'administrator'
    } catch {
      /* ignore */
    }

    const [pro, memberCovered, managedIds, placeSubs] = await Promise.all([
      resolveProBilling(uid),
      userHasPlaceCoveredFree(uid),
      listManagedCommunityIds(uid),
      listPlaceSubscriptionsForUser(uid),
    ])

    const communityIds = new Set<number>(managedIds)
    for (const s of placeSubs) {
      if (s.community_id) communityIds.add(s.community_id)
    }

    const places = await Promise.all(
      [...communityIds].map((id) => resolvePlaceBilling(id))
    )

    return NextResponse.json({
      billing_public: isBillingPublic(),
      can_see_cta: isBillingPublic() || isAdmin,
      member_covered: memberCovered,
      pro,
      places,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
