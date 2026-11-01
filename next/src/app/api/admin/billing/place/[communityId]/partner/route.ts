/**
 * POST /api/admin/billing/place/[communityId]/partner
 * Body: { partner: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { setBillingPartner } from '@/lib/db-billing'
import { resolvePlaceBilling } from '@/lib/billing-access'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ communityId: string }> }
) {
  try {
    await requireAdmin(req)
    const { communityId: raw } = await ctx.params
    const communityId = parseInt(raw, 10)
    if (!communityId) {
      return NextResponse.json({ error: 'communityId invalide' }, { status: 422 })
    }
    const body = await req.json().catch(() => ({}))
    const partner = Boolean(body.partner)
    await setBillingPartner(communityId, partner)
    const place = await resolvePlaceBilling(communityId)
    return NextResponse.json({ ok: true, place })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
