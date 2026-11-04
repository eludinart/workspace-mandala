/**
 * POST /api/admin/billing/place/comp
 * Body: { months?: number, community_ids?: number[] }
 * Cadeau abonnement Lieu (trialing, payment_provider=comp) pour les lieux donnés,
 * ou tous les lieux actifs si community_ids omis.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import {
  findPlaceManagerUserId,
  grantComplimentaryPlaceSubscription,
  listActiveCommunityIds,
} from '@/lib/db-billing'
import { resolvePlaceBilling } from '@/lib/billing-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId: adminUserId } = await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      months?: number
      community_ids?: number[]
      all_active?: boolean
    }
    const months = Number(body.months ?? 6)
    if (!Number.isFinite(months) || months < 1 || months > 36) {
      return NextResponse.json({ error: 'months invalide (1–36)' }, { status: 422 })
    }

    const ids =
      Array.isArray(body.community_ids) && body.community_ids.length > 0
        ? body.community_ids.map((n) => Number(n)).filter((n) => n > 0)
        : body.all_active
          ? await listActiveCommunityIds()
          : []
    if (!ids.length) {
      return NextResponse.json(
        { error: 'community_ids requis (ou all_active: true)' },
        { status: 422 }
      )
    }

    const granted: Array<{
      community_id: number
      ok: boolean
      error?: string
      place?: Awaited<ReturnType<typeof resolvePlaceBilling>>
    }> = []

    const adminUid = parseInt(adminUserId, 10) || 0
    for (const communityId of ids) {
      const managerId = (await findPlaceManagerUserId(communityId)) || adminUid
      if (!managerId) {
        granted.push({
          community_id: communityId,
          ok: false,
          error: 'Aucun gestionnaire sur ce lieu',
        })
        continue
      }
      const sub = await grantComplimentaryPlaceSubscription({
        communityId,
        userId: managerId,
        months,
      })
      if (!sub) {
        granted.push({
          community_id: communityId,
          ok: false,
          error: 'Échec grant',
        })
        continue
      }
      const place = await resolvePlaceBilling(communityId)
      granted.push({ community_id: communityId, ok: true, place })
    }

    return NextResponse.json({
      ok: granted.every((g) => g.ok),
      months,
      granted,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
