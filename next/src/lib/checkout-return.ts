/**
 * Retour Stripe / Play Billing → /app?checkout=…
 */

export type CheckoutReturnStatus = 'success' | 'canceled'

export type CheckoutReturnState = {
  status: CheckoutReturnStatus
  planId: string | null
  planFamily: 'place' | 'pro' | null
  provider: string | null
  communityId: number | null
}

export function buildCheckoutReturnPath(opts: {
  status: CheckoutReturnStatus
  planId: string
  planFamily: 'place' | 'pro'
  provider?: 'stripe' | 'play'
  communityId?: number | null
}): string {
  const q = new URLSearchParams()
  q.set('checkout', opts.status)
  q.set('plan', opts.planId)
  q.set('plan_family', opts.planFamily)
  if (opts.provider) q.set('provider', opts.provider)
  if (opts.communityId && opts.communityId > 0) {
    q.set('community_id', String(opts.communityId))
  }
  return `/app?${q.toString()}`
}

export function parseCheckoutReturnFromSearch(
  search: string
): CheckoutReturnState | null {
  const q = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  )
  const raw = (q.get('checkout') || '').trim().toLowerCase()
  if (raw !== 'success' && raw !== 'canceled' && raw !== 'cancelled') {
    return null
  }
  const status: CheckoutReturnStatus =
    raw === 'success' ? 'success' : 'canceled'
  const planId = (q.get('plan') || '').trim() || null
  const familyRaw = (q.get('plan_family') || '').trim().toLowerCase()
  let planFamily: 'place' | 'pro' | null = null
  if (familyRaw === 'place' || familyRaw === 'pro') {
    planFamily = familyRaw
  } else if (planId?.startsWith('place_')) {
    planFamily = 'place'
  } else if (planId?.startsWith('pro_')) {
    planFamily = 'pro'
  }
  const communityRaw = parseInt(q.get('community_id') || '', 10)
  return {
    status,
    planId,
    planFamily,
    provider: (q.get('provider') || '').trim() || null,
    communityId:
      Number.isFinite(communityRaw) && communityRaw > 0 ? communityRaw : null,
  }
}

/** Retire checkout / plan / plan_family / provider / community_id de l’URL sans recharger. */
export function clearCheckoutParamsFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    for (const key of [
      'checkout',
      'plan',
      'plan_family',
      'provider',
      'community_id',
    ]) {
      u.searchParams.delete(key)
    }
    const next = `${u.pathname}${u.search}${u.hash}`
    window.history.replaceState(window.history.state, '', next)
  } catch {
    /* ignore */
  }
}
