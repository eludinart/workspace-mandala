/**
 * Catalogue billing Mandala — le client n'envoie qu'un product_id.
 */
import billingProducts from '@/data/billing-products.json'

export type PlanFamily = 'place' | 'pro'

export type ResolvedProduct = {
  productId: string
  priceId: string
  mode: 'subscription'
  planId: string
  planFamily: PlanFamily
}

export type PublicBillingProduct = {
  product_id: string
  plan_id: string
  plan_family: PlanFamily
  label: string
  amount_cents: number
  unit: string
  configured: boolean
}

type CatalogSub = {
  price_id_env: string
  plan_id?: string
  plan_family?: string
  label?: string
  amount_cents?: number
  unit?: string
}

function envPrice(envKey: string): string {
  return (process.env[envKey] || '').trim()
}

function asPlanFamily(v: unknown): PlanFamily | null {
  return v === 'place' || v === 'pro' ? v : null
}

/** Résout un produit ; null si inconnu ou prix Stripe non configuré. */
export function resolveBillingProduct(productId: string): ResolvedProduct | null {
  const id = String(productId || '').trim()
  if (!id) return null

  const subs =
    (billingProducts as { subscriptions?: Record<string, CatalogSub> }).subscriptions ?? {}
  const sub = subs[id]
  if (!sub) return null

  const planFamily = asPlanFamily(sub.plan_family)
  if (!planFamily) return null

  const priceId = envPrice(sub.price_id_env)
  if (!priceId) return null

  return {
    productId: id,
    priceId,
    mode: 'subscription',
    planId: sub.plan_id ?? id,
    planFamily,
  }
}

/** Liste publique (pas de price_id). */
export function listBillingProducts(): PublicBillingProduct[] {
  const subs =
    (billingProducts as { subscriptions?: Record<string, CatalogSub> }).subscriptions ?? {}
  return Object.entries(subs).map(([productId, sub]) => {
    const planFamily = asPlanFamily(sub.plan_family) ?? 'pro'
    return {
      product_id: productId,
      plan_id: sub.plan_id ?? productId,
      plan_family: planFamily,
      label: sub.label ?? productId,
      amount_cents: Number(sub.amount_cents ?? 0) || 0,
      unit: sub.unit ?? '',
      configured: Boolean(envPrice(sub.price_id_env)),
    }
  })
}

/** Anti open-redirect : ré-ancre le chemin sur la base publique. */
export function safeReturnUrl(base: string, clientUrl: unknown, fallbackPath: string): string {
  const cleanBase = base.replace(/\/+$/, '')
  const raw = String(clientUrl ?? '').trim()
  if (!raw) return `${cleanBase}${fallbackPath}`
  try {
    const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://placeholder.local')
    const path = `${u.pathname}${u.search}` || fallbackPath
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim()
    const relative =
      basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path
    return `${cleanBase}${relative.startsWith('/') ? relative : `/${relative}`}`
  } catch {
    return `${cleanBase}${fallbackPath}`
  }
}
