/**
 * GET /api/admin/billing/smoke — diagnostic Stripe / catalogue (admin).
 * Ne révèle jamais les secrets, seulement présents / absents / configurés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { listBillingProducts } from '@/lib/billing-catalog'
import { isBillingPublic } from '@/lib/billing-door'
import { getStripeSecretKey } from '@/lib/stripe'
import { isDbConfigured } from '@/lib/db'
import { ensureBillingTables } from '@/lib/db-billing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const secret = getStripeSecretKey()
    const webhook = Boolean((process.env.STRIPE_WEBHOOK_SECRET || '').trim())
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim()
    const products = listBillingProducts()
    const stripeConfigured = products.filter((p) => p.configured)
    const playConfigured = products.filter((p) => p.play_configured)

    let dbOk = false
    if (isDbConfigured()) {
      try {
        await ensureBillingTables()
        dbOk = true
      } catch {
        dbOk = false
      }
    }

    const mode = secret.startsWith('sk_live_')
      ? 'live'
      : secret.startsWith('sk_test_')
        ? 'test'
        : secret
          ? 'unknown'
          : 'missing'

    const readyForAdminCheckout =
      Boolean(secret) &&
      webhook &&
      Boolean(appUrl) &&
      stripeConfigured.length === products.length &&
      dbOk

    return NextResponse.json({
      ok: readyForAdminCheckout,
      billing_public: isBillingPublic(),
      stripe: {
        secret_present: Boolean(secret),
        mode,
        webhook_secret_present: webhook,
        app_url: appUrl || null,
        prices_configured: stripeConfigured.length,
        prices_total: products.length,
      },
      play: {
        skus_configured: playConfigured.length,
        skus_total: products.length,
      },
      db: { configured: isDbConfigured(), billing_tables_ok: dbOk },
      products: products.map((p) => ({
        product_id: p.product_id,
        label: p.label,
        stripe_configured: p.configured,
        play_configured: Boolean(p.play_configured),
      })),
      checklist: {
        stripe_secret: Boolean(secret),
        webhook_secret: webhook,
        all_prices: stripeConfigured.length === products.length,
        app_url: Boolean(appUrl),
        db: dbOk,
        portal_note:
          'Activer Customer Portal dans Stripe Dashboard (Settings → Billing → Customer portal).',
        keep_door_closed: !isBillingPublic(),
      },
      next_steps: readyForAdminCheckout
        ? [
            'Smoke manuel : compte admin → Offres → checkout test carte 4242…',
            'Vérifier webhook reçu (Dashboard Stripe → Webhooks → attempts).',
            'Garder MANDALA_BILLING_PUBLIC=0 jusqu’à ouverture volontaire.',
          ]
        : [
            'Lancer node scripts/stripe-setup-mandala.mjs avec STRIPE_SECRET_KEY',
            'Coller les STRIPE_PRICE_* + STRIPE_WEBHOOK_SECRET dans Coolify Mandala',
            'Redéployer / redémarrer le conteneur Mandala',
            'Relancer ce smoke',
          ],
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
