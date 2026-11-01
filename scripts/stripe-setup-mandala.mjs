#!/usr/bin/env node
/**
 * Crée (ou réutilise) les 4 prix Stripe Mandala et affiche les variables Coolify.
 *
 * Usage :
 *   $env:STRIPE_SECRET_KEY="sk_test_…"
 *   node scripts/stripe-setup-mandala.mjs
 *
 * Options :
 *   --json     sortie JSON uniquement
 *   --live-ok  autorise une clé sk_live_ (sinon refuse hors test)
 */
const STRIPE_API = 'https://api.stripe.com/v1'

const PRODUCTS = [
  {
    env: 'STRIPE_PRICE_PLACE_MONTHLY',
    productName: 'Mandala — Offre Lieu',
    productMeta: { mandala_plan_family: 'place', mandala_plan_id: 'place_monthly' },
    nickname: 'Lieu mensuel',
    unit_amount: 2900,
    interval: 'month',
  },
  {
    env: 'STRIPE_PRICE_PLACE_YEARLY',
    productName: 'Mandala — Offre Lieu',
    productMeta: { mandala_plan_family: 'place', mandala_plan_id: 'place_yearly' },
    nickname: 'Lieu annuel',
    unit_amount: 29000,
    interval: 'year',
  },
  {
    env: 'STRIPE_PRICE_PRO_MONTHLY',
    productName: 'Mandala Pro',
    productMeta: { mandala_plan_family: 'pro', mandala_plan_id: 'pro_monthly' },
    nickname: 'Pro mensuel',
    unit_amount: 1200,
    interval: 'month',
  },
  {
    env: 'STRIPE_PRICE_PRO_YEARLY',
    productName: 'Mandala Pro',
    productMeta: { mandala_plan_family: 'pro', mandala_plan_id: 'pro_yearly' },
    nickname: 'Pro annuel',
    unit_amount: 12000,
    interval: 'year',
  },
]

const key = (process.env.STRIPE_SECRET_KEY || '').trim()
const asJson = process.argv.includes('--json')
const liveOk = process.argv.includes('--live-ok')

if (!key) {
  console.error('STRIPE_SECRET_KEY manquant')
  process.exit(1)
}
if (key.startsWith('sk_live_') && !liveOk) {
  console.error('Clé live refusée sans --live-ok (utilisez sk_test_ d’abord)')
  process.exit(1)
}

async function stripe(method, path, form) {
  const headers = { Authorization: `Bearer ${key}` }
  let body
  if (method === 'POST' && form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(form).toString()
  }
  const res = await fetch(`${STRIPE_API}${path}`, { method, headers, body })
  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data)
    throw new Error(`${method} ${path}: ${msg}`)
  }
  return data
}

async function findOrCreateProduct(name, meta) {
  const list = await stripe('GET', `/products?active=true&limit=100`)
  const found = (list.data || []).find(
    (p) =>
      p.name === name &&
      p.metadata?.mandala_plan_family === meta.mandala_plan_family
  )
  if (found) return found
  const form = { name, 'metadata[app]': 'mandala' }
  for (const [k, v] of Object.entries(meta)) form[`metadata[${k}]`] = v
  return stripe('POST', '/products', form)
}

async function findOrCreatePrice(productId, spec) {
  const list = await stripe('GET', `/prices?product=${productId}&active=true&limit=100`)
  const found = (list.data || []).find(
    (p) =>
      p.nickname === spec.nickname &&
      p.unit_amount === spec.unit_amount &&
      p.recurring?.interval === spec.interval &&
      p.currency === 'eur'
  )
  if (found) return found
  return stripe('POST', '/prices', {
    product: productId,
    currency: 'eur',
    unit_amount: String(spec.unit_amount),
    'recurring[interval]': spec.interval,
    nickname: spec.nickname,
    'metadata[app]': 'mandala',
    [`metadata[mandala_plan_id]`]: spec.productMeta.mandala_plan_id,
    [`metadata[mandala_plan_family]`]: spec.productMeta.mandala_plan_family,
  })
}

async function ensureWebhook(url) {
  const list = await stripe('GET', '/webhook_endpoints?limit=100')
  const existing = (list.data || []).find((w) => w.url === url)
  if (existing) {
    return { id: existing.id, secret: null, reused: true }
  }
  const events = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]
  const form = { url }
  events.forEach((e, i) => {
    form[`enabled_events[${i}]`] = e
  })
  const created = await stripe('POST', '/webhook_endpoints', form)
  return { id: created.id, secret: created.secret || null, reused: false }
}

const byProductName = new Map()
const prices = {}

for (const spec of PRODUCTS) {
  let product = byProductName.get(spec.productName)
  if (!product) {
    product = await findOrCreateProduct(spec.productName, {
      mandala_plan_family: spec.productMeta.mandala_plan_family,
    })
    byProductName.set(spec.productName, product)
  }
  const price = await findOrCreatePrice(product.id, spec)
  prices[spec.env] = price.id
}

const webhookUrl = 'https://mandala.eludein.art/api/billing/stripe-webhook'
let webhook
try {
  webhook = await ensureWebhook(webhookUrl)
} catch (e) {
  webhook = { error: String(e.message || e) }
}

const out = {
  mode: key.startsWith('sk_live_') ? 'live' : 'test',
  prices,
  webhook,
  coolify_env: {
    MANDALA_BILLING_PUBLIC: '0',
    NEXT_PUBLIC_APP_URL: 'https://mandala.eludein.art',
    STRIPE_SECRET_KEY: '(même compte que Fleur / votre sk_…)',
    STRIPE_WEBHOOK_SECRET: webhook.secret || '(récupérer whsec_ dans Dashboard si endpoint réutilisé)',
    ...prices,
  },
}

if (asJson) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log(`Mode Stripe : ${out.mode}`)
  console.log('\nVariables à coller dans Coolify (Mandala) :\n')
  for (const [k, v] of Object.entries(out.coolify_env)) {
    console.log(`${k}=${v}`)
  }
  if (webhook.reused) {
    console.log(
      '\nWebhook déjà présent — copiez le signing secret depuis Stripe Dashboard → Webhooks.'
    )
  } else if (webhook.secret) {
    console.log(`\nNouveau webhook créé : ${webhook.id}`)
    console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`)
  } else if (webhook.error) {
    console.log(`\nWebhook non créé automatiquement : ${webhook.error}`)
  }
}
