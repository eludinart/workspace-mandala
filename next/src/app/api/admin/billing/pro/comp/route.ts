/**
 * GET  /api/admin/billing/pro/comp?user_id=
 * POST /api/admin/billing/pro/comp { user_id, months?, tagline?, revoke? }
 * Cadeau / forçage Mandala Pro (payment_provider=comp) + profil verified.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import {
  getAdminProVisibilitySnapshot,
  grantComplimentaryProSubscription,
  revokeAdminForcedProVisibility,
} from '@/lib/db-billing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const userId = parseInt(req.nextUrl.searchParams.get('user_id') ?? '', 10)
    if (!userId) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 422 })
    }
    const snapshot = await getAdminProVisibilitySnapshot(userId)
    return NextResponse.json({ user_id: userId, pro: snapshot })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: adminUserId } = await requireAdmin(req)
    const reviewerId = parseInt(adminUserId, 10) || 0
    const body = (await req.json().catch(() => ({}))) as {
      user_id?: number
      months?: number
      tagline?: string
      revoke?: boolean
    }
    const targetId = Number(body.user_id ?? 0)
    if (!targetId) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 422 })
    }

    if (body.revoke) {
      const result = await revokeAdminForcedProVisibility({
        userId: targetId,
        reviewerId,
      })
      const snapshot = await getAdminProVisibilitySnapshot(targetId)
      return NextResponse.json({
        ok: true,
        revoked: result.revokedComp,
        pro: snapshot,
      })
    }

    const months = Number(body.months ?? 6)
    if (![1, 2, 3, 4, 5, 6].includes(months)) {
      return NextResponse.json({ error: 'months invalide (1–6)' }, { status: 422 })
    }

    await grantComplimentaryProSubscription({
      userId: targetId,
      months,
      reviewerId,
      tagline: body.tagline,
    })
    const snapshot = await getAdminProVisibilitySnapshot(targetId)
    return NextResponse.json({
      ok: true,
      months,
      pro: snapshot,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
