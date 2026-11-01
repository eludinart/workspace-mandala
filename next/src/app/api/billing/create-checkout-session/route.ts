/**
 * POST /api/billing/create-checkout-session
 * Body: { product_id, community_id?, success_url?, cancel_url? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, getAuthHeader, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { resolveBillingProduct, safeReturnUrl } from '@/lib/billing-catalog'
import { assertBillingCtaAllowed } from '@/lib/billing-door'
import { createCheckoutSession, getStripeSecretKey } from '@/lib/stripe'
import {
  canManageCommunityInContext,
  getCommunityMembership,
} from '@/lib/db-communities'
import { jwtDecode } from '@/lib/jwt'

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

    if (!getStripeSecretKey()) {
      return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const productId = String(body.product_id ?? '').trim()
    if (!productId) {
      return NextResponse.json({ error: 'product_id requis' }, { status: 422 })
    }

    const product = resolveBillingProduct(productId)
    if (!product) {
      return NextResponse.json(
        { error: `Produit inconnu ou non configuré : ${productId}` },
        { status: 422 }
      )
    }

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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || ''
    const base =
      appUrl ||
      (typeof req.nextUrl !== 'undefined' ? req.nextUrl.origin : '')
    if (!base) {
      return NextResponse.json(
        { error: 'URL publique non configurée (NEXT_PUBLIC_APP_URL)' },
        { status: 503 }
      )
    }

    const successUrl = safeReturnUrl(base, body.success_url, '/app?checkout=success')
    const cancelUrl = safeReturnUrl(base, body.cancel_url, '/app?checkout=canceled')

    const token = getAuthHeader(req)
    const payload = token ? jwtDecode(token) : null
    const customerEmail = payload?.email?.trim() || undefined

    const metadata: Record<string, string> = {
      user_id: userId,
      plan_id: product.planId,
      plan_family: product.planFamily,
    }
    if (communityId) metadata.community_id = String(communityId)

    const result = await createCheckoutSession({
      priceId: product.priceId,
      mode: 'subscription',
      successUrl,
      cancelUrl,
      clientReferenceId: userId,
      customerEmail,
      metadata,
    })

    if (!result?.url) {
      return NextResponse.json(
        { error: 'Impossible de créer la session de paiement' },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: result.url, session_id: result.id })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json(
      { error: e.message || 'Erreur checkout' },
      { status: status === 401 ? 401 : status === 403 ? 403 : status === 404 ? 404 : 500 }
    )
  }
}
