/**
 * POST /api/billing/play/acknowledge
 * Body: { product_id, purchase_token, community_id?, order_id? }
 *
 * Après PaymentRequest Play côté client : vérifie (ou stub) puis active
 * l’entitlement dans mdl_mandala_billing_subscriptions.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { resolveBillingProductMeta } from '@/lib/billing-catalog'
import { assertBillingCtaAllowed } from '@/lib/billing-door'
import {
  canManageCommunityInContext,
  getCommunityMembership,
} from '@/lib/db-communities'
import { upsertPlaySubscription } from '@/lib/db-billing'
import { playPackageName, verifyPlaySubscriptionPurchase } from '@/lib/play-billing-verify'

export const dynamic = 'force-dynamic'

async function isAppAdminUser(userId: string): Promise<boolean> {
  try {
    const user = await authMe(parseInt(userId, 10))
    const role = String(user.app_role || user.wp_role || '').toLowerCase()
    return role === 'admin' || role === 'administrator'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const isAdmin = await isAppAdminUser(userId)
    assertBillingCtaAllowed(isAdmin)

    const body = await req.json().catch(() => ({}))
    const productId = String(body.product_id ?? '').trim()
    const purchaseToken = String(body.purchase_token ?? '').trim()
    if (!productId || !purchaseToken) {
      return NextResponse.json(
        { error: 'product_id et purchase_token requis' },
        { status: 422 }
      )
    }

    const product = resolveBillingProductMeta(productId)
    if (!product) {
      return NextResponse.json({ error: 'Produit inconnu' }, { status: 422 })
    }

    const playSku = product.playSku || productId
    let communityId: number | null = null
    if (product.planFamily === 'place') {
      communityId = parseInt(String(body.community_id ?? ''), 10)
      if (!communityId || communityId <= 0) {
        return NextResponse.json(
          { error: 'community_id requis pour l’offre Lieu' },
          { status: 422 }
        )
      }
      if (!isAdmin) {
        try {
          const { role } = await getCommunityMembership(parseInt(userId, 10), communityId)
          if (!canManageCommunityInContext(role, false)) {
            return NextResponse.json(
              { error: 'Seuls les gestionnaires du lieu peuvent souscrire' },
              { status: 403 }
            )
          }
        } catch {
          return NextResponse.json(
            { error: 'Seuls les gestionnaires du lieu peuvent souscrire' },
            { status: 403 }
          )
        }
      }
    }

    const verified = await verifyPlaySubscriptionPurchase({
      packageName: playPackageName(),
      subscriptionId: playSku,
      purchaseToken,
    })
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 502 })
    }

    const periodEnd = verified.expiryTimeMillis
      ? new Date(verified.expiryTimeMillis)
      : null

    await upsertPlaySubscription({
      userId: parseInt(userId, 10),
      communityId,
      planFamily: product.planFamily,
      planId: product.planId,
      purchaseToken,
      orderId: body.order_id ? String(body.order_id) : verified.orderId,
      productId,
      rawJson: JSON.stringify({ stub: verified.stub, playSku }),
      currentPeriodEnd: periodEnd,
    })

    return NextResponse.json({
      ok: true,
      provider: 'play',
      stub: verified.stub,
      plan_id: product.planId,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json(
      { error: e.message || 'Erreur Play Billing' },
      { status: status === 401 ? 401 : status === 403 ? 403 : 500 }
    )
  }
}
