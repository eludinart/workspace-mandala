/**
 * POST /api/billing/stripe-webhook — sync abonnements Lieu / Mandala Pro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhookSignature } from '@/lib/stripe-webhook'
import {
  claimStripeWebhookEvent,
  releaseStripeWebhookEvent,
} from '@/lib/db-stripe-webhook'
import { fetchStripeSubscription } from '@/lib/stripe'
import {
  markSubscriptionStatus,
  upsertCustomer,
  upsertSubscription,
} from '@/lib/db-billing'
import { isDbConfigured } from '@/lib/db'
import type { PlanFamily } from '@/lib/billing-catalog'

export const dynamic = 'force-dynamic'

function metaFromObject(metaRaw: unknown): Record<string, string> {
  if (!metaRaw || typeof metaRaw !== 'object' || Array.isArray(metaRaw)) return {}
  return Object.fromEntries(
    Object.entries(metaRaw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
  )
}

function periodEndFromSub(sub: Record<string, unknown>): Date | null {
  const raw = sub.current_period_end
  if (typeof raw === 'number' && raw > 0) return new Date(raw * 1000)
  return null
}

function priceIdFromSub(sub: Record<string, unknown>): string | null {
  const items = sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined
  const id = items?.data?.[0]?.price?.id
  return id ? String(id) : null
}

async function handleCheckoutSessionCompleted(
  session: Record<string, unknown>
): Promise<void> {
  const meta = metaFromObject(session.metadata)
  const userId = parseInt(meta.user_id ?? String(session.client_reference_id ?? ''), 10)
  if (!userId) return

  const customerRaw = session.customer
  const customerId =
    typeof customerRaw === 'string'
      ? customerRaw
      : String((customerRaw as { id?: string })?.id ?? '')
  if (customerId.startsWith('cus_')) {
    await upsertCustomer(userId, customerId)
  }

  const subRaw = session.subscription
  const subId =
    typeof subRaw === 'string'
      ? subRaw
      : String((subRaw as { id?: string })?.id ?? '')
  if (!subId.startsWith('sub_')) return

  const sub = (await fetchStripeSubscription(subId)) ?? {}
  const subMeta = { ...metaFromObject(sub.metadata), ...meta }
  const planFamily = (subMeta.plan_family === 'place' ? 'place' : 'pro') as PlanFamily
  const planId = (subMeta.plan_id || planFamily).slice(0, 40)
  const communityId =
    planFamily === 'place' ? parseInt(subMeta.community_id || '', 10) || null : null
  const status = String(sub.status ?? 'active')

  await upsertSubscription({
    userId,
    communityId,
    planFamily,
    planId,
    status,
    stripeSubscriptionId: subId,
    stripePriceId: priceIdFromSub(sub),
    currentPeriodEnd: periodEndFromSub(sub),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  })
}

async function handleSubscriptionChanged(sub: Record<string, unknown>): Promise<void> {
  const subId = String(sub.id ?? '')
  if (!subId.startsWith('sub_')) return

  const meta = metaFromObject(sub.metadata)
  const existing = await markSubscriptionStatus(
    subId,
    String(sub.status ?? 'canceled'),
    periodEndFromSub(sub),
    Boolean(sub.cancel_at_period_end)
  )

  if (existing) return

  const userId = parseInt(meta.user_id ?? '', 10)
  if (!userId) return
  const planFamily = (meta.plan_family === 'place' ? 'place' : 'pro') as PlanFamily
  const communityId =
    planFamily === 'place' ? parseInt(meta.community_id || '', 10) || null : null

  await upsertSubscription({
    userId,
    communityId,
    planFamily,
    planId: (meta.plan_id || planFamily).slice(0, 40),
    status: String(sub.status ?? 'active'),
    stripeSubscriptionId: subId,
    stripePriceId: priceIdFromSub(sub),
    currentPeriodEnd: periodEndFromSub(sub),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  })
}

export async function POST(req: NextRequest) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Webhook non configuré' }, { status: 503 })
  }

  const raw = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!verifyStripeWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ success: false, error: 'Signature invalide' }, { status: 400 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Base de données non configurée' },
      { status: 503 }
    )
  }

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(raw) as typeof event
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalide' }, { status: 400 })
  }

  const eventId = String(event.id ?? '').trim()
  const eventType = String(event.type ?? '').trim()
  if (!eventId) {
    return NextResponse.json({ success: false, error: 'Événement sans id' }, { status: 400 })
  }

  const claimed = await claimStripeWebhookEvent(eventId, eventType)
  if (!claimed) {
    return NextResponse.json({ success: true, duplicate: true })
  }

  try {
    const obj = event.data?.object ?? {}
    if (eventType === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(obj)
    } else if (
      eventType === 'customer.subscription.updated' ||
      eventType === 'customer.subscription.deleted'
    ) {
      await handleSubscriptionChanged(obj)
    } else if (eventType === 'invoice.payment_failed') {
      const subRaw = obj.subscription
      const subId =
        typeof subRaw === 'string'
          ? subRaw
          : String((subRaw as { id?: string })?.id ?? '')
      if (subId.startsWith('sub_')) {
        await markSubscriptionStatus(subId, 'past_due', null, false)
      }
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    await releaseStripeWebhookEvent(eventId)
    console.error('[billing webhook]', err)
    return NextResponse.json({ success: false, error: 'Traitement échoué' }, { status: 500 })
  }
}
