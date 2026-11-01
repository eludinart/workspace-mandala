/**
 * POST /api/billing/portal — session Stripe Customer Portal (gérer / résilier abo).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { getStripeCustomerIdForUser } from '@/lib/db-billing'
import { createBillingPortalSession, getStripeSecretKey } from '@/lib/stripe'
import { safeReturnUrl } from '@/lib/billing-catalog'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!getStripeSecretKey()) {
      return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
    }
    const customerId = await getStripeCustomerIdForUser(parseInt(userId, 10))
    if (!customerId) {
      return NextResponse.json(
        {
          error:
            'Aucun abonnement Stripe lié à ce compte. Souscrivez d’abord, ou gérez un abo Play dans Google Play.',
        },
        { status: 404 }
      )
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || ''
    const base =
      appUrl ||
      (typeof req.nextUrl !== 'undefined' ? req.nextUrl.origin : '')
    if (!base) {
      return NextResponse.json({ error: 'URL publique non configurée' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const returnUrl = safeReturnUrl(base, body.return_url, '/app?page=account')

    const session = await createBillingPortalSession({
      customerId,
      returnUrl,
    })
    if (!session?.url) {
      return NextResponse.json(
        { error: 'Portail Stripe indisponible (activer Customer Portal dans le Dashboard).' },
        { status: 502 }
      )
    }
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur portail' }, { status })
  }
}
