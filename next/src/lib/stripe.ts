/**
 * Appels API Stripe (checkout) — sans SDK, pattern Fleur adapté Mandala.
 */
const STRIPE_API = 'https://api.stripe.com/v1'

export function getStripeSecretKey(): string {
  return (process.env.STRIPE_SECRET_KEY || '').trim()
}

async function stripeFetch(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, string>
): Promise<Record<string, unknown> | null> {
  const key = getStripeSecretKey()
  if (!key) return null

  const url = `${STRIPE_API}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  }

  let res: Response
  if (method === 'GET') {
    res = await fetch(url, { method: 'GET', headers })
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const formBody = body ? new URLSearchParams(body).toString() : ''
    res = await fetch(url, { method: 'POST', headers, body: formBody })
  }

  const data = await res.json().catch(() => null)
  if (!res.ok || !data || (data as { error?: unknown }).error) return null
  return data as Record<string, unknown>
}

/** Crée une session Stripe Checkout (abonnement). */
export async function createCheckoutSession(params: {
  priceId: string
  mode: 'payment' | 'subscription'
  successUrl: string
  cancelUrl: string
  clientReferenceId: string
  customerEmail?: string
  quantity?: number
  metadata: Record<string, string>
}): Promise<{ url?: string; id?: string } | null> {
  const key = getStripeSecretKey()
  if (!key) return null

  const quantity = Math.max(1, parseInt(String(params.quantity ?? 1), 10) || 1)
  const form: Record<string, string> = {
    mode: params.mode,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.clientReferenceId,
    'line_items[0][price]': params.priceId,
    'line_items[0][quantity]': String(quantity),
    'payment_method_types[0]': 'card',
  }
  if (params.customerEmail) form.customer_email = params.customerEmail

  if (params.mode === 'subscription') {
    form['subscription_data[metadata][user_id]'] = params.metadata.user_id || ''
    form['subscription_data[metadata][plan_id]'] = params.metadata.plan_id || ''
    form['subscription_data[metadata][plan_family]'] = params.metadata.plan_family || ''
    if (params.metadata.community_id) {
      form['subscription_data[metadata][community_id]'] = params.metadata.community_id
    }
  }

  for (const [k, v] of Object.entries(params.metadata)) {
    if (v == null || v === '') continue
    form[`metadata[${k}]`] = String(v)
  }

  const data = await stripeFetch('POST', '/checkout/sessions', form)
  if (!data) return null
  return {
    url: (data as { url?: string }).url,
    id: (data as { id?: string }).id,
  }
}

/** Récupère une subscription Stripe. */
export async function fetchStripeSubscription(
  subscriptionId: string
): Promise<Record<string, unknown> | null> {
  if (!subscriptionId?.startsWith('sub_')) return null
  return stripeFetch('GET', `/subscriptions/${subscriptionId}`)
}

/** Récupère un Price Stripe (montant catalogue). */
export async function fetchStripePrice(
  priceId: string
): Promise<{ unit_amount: number | null; currency: string | null } | null> {
  const id = String(priceId || '').trim()
  if (!id.startsWith('price_')) return null
  const data = await stripeFetch('GET', `/prices/${encodeURIComponent(id)}`)
  if (!data) return null
  const raw = data.unit_amount
  const unit_amount =
    typeof raw === 'number' && Number.isFinite(raw) ? raw : null
  const currency =
    typeof data.currency === 'string' ? data.currency.toLowerCase() : null
  return { unit_amount, currency }
}

/** Portail client Stripe (résiliation / moyens de paiement). */
export async function createBillingPortalSession(params: {
  customerId: string
  returnUrl: string
}): Promise<{ url?: string } | null> {
  if (!params.customerId?.startsWith('cus_')) return null
  const data = await stripeFetch('POST', '/billing_portal/sessions', {
    customer: params.customerId,
    return_url: params.returnUrl,
  })
  if (!data) return null
  return { url: (data as { url?: string }).url }
}
