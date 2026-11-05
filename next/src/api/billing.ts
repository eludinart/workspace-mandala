import { api } from '@/lib/api-client'

export type BillingProduct = {
  product_id: string
  plan_id: string
  plan_family: 'place' | 'pro'
  label: string
  amount_cents: number
  unit: string
  configured: boolean
  play_configured?: boolean
  play_sku?: string | null
}

export const billingApi = {
  listProducts: () =>
    api.get('/api/billing/products') as Promise<{
      billing_public: boolean
      products: BillingProduct[]
    }>,

  getAccess: () =>
    api.get('/api/billing/access') as Promise<{
      billing_public: boolean
      can_see_cta: boolean
      member_covered: boolean
      pro: Record<string, unknown>
      places: Array<{
        communityId?: number
        community_id?: number
        status?: string
        planId?: string | null
        plan_id?: string | null
        currentPeriodEnd?: string | null
        current_period_end?: string | null
        coveredMemberCount?: number
        covered_member_count?: number
        featured?: boolean
        partner?: boolean
        [key: string]: unknown
      }>
      comp_alerts?: Array<{
        community_id: number
        place_name: string
        kind: 'warn' | 'grace'
        period_end: string
        grace_ends_at: string
      }>
    }>,

  grantPlaceComp: (body: { months: number; community_ids: number[] }) =>
    api.post('/api/admin/billing/place/comp', body) as Promise<{
      ok: boolean
      months: number
      granted: Array<{
        community_id: number
        ok: boolean
        error?: string
        place?: Record<string, unknown>
      }>
    }>,

  createCheckoutSession: (body: {
    product_id: string
    community_id?: number
    success_url?: string
    cancel_url?: string
  }) =>
    api.post('/api/billing/create-checkout-session', body) as Promise<{
      url: string
      session_id?: string
    }>,

  acknowledgePlayPurchase: (body: {
    product_id: string
    purchase_token: string
    community_id?: number
    order_id?: string
  }) =>
    api.post('/api/billing/play/acknowledge', body) as Promise<{
      ok: boolean
      provider: string
      stub?: boolean
      plan_id: string
    }>,

  submitPro: (body: {
    tagline?: string
    modalities?: string
    service_area?: string
    external_url?: string
  }) => api.post('/api/billing/pro/submit', body) as Promise<{ ok: boolean; profile: unknown }>,

  listPendingPro: () =>
    api.get('/api/billing/pro/pending') as Promise<{
      pending: unknown[]
      scope: string
    }>,

  reviewPro: (
    userId: number,
    body: { decision: 'verified' | 'rejected'; reason?: string }
  ) =>
    api.post(`/api/billing/pro/${userId}/review`, body) as Promise<{
      ok: boolean
      profile: unknown
    }>,

  setPlacePartner: (communityId: number, partner: boolean) =>
    api.post(`/api/admin/billing/place/${communityId}/partner`, {
      partner,
    }) as Promise<{ ok: boolean; place: unknown }>,

  openPortal: (return_url?: string) =>
    api.post('/api/billing/portal', { return_url }) as Promise<{ url: string }>,

  adminSmoke: () =>
    api.get('/api/admin/billing/smoke') as Promise<{
      ok: boolean
      billing_public: boolean
      stripe: Record<string, unknown>
      play: Record<string, unknown>
      db: Record<string, unknown>
      products: Array<Record<string, unknown>>
      checklist: Record<string, unknown>
      next_steps: string[]
    }>,

  listAdminSubscriptions: (params?: {
    family?: 'all' | 'place' | 'pro'
    sort?:
      | 'urgency'
      | 'period_end'
      | 'family'
      | 'target'
      | 'provider'
      | 'updated_at'
    order?: 'asc' | 'desc'
  }) => {
    const q = new URLSearchParams()
    if (params?.family && params.family !== 'all') q.set('family', params.family)
    if (params?.sort) q.set('sort', params.sort)
    if (params?.order) q.set('order', params.order)
    const qs = q.toString()
    return api.get(
      `/api/admin/billing/subscriptions${qs ? `?${qs}` : ''}`
    ) as Promise<{
      items: Array<{
        id: number
        user_id: number
        user_email: string | null
        user_display_name: string | null
        community_id: number | null
        community_name: string | null
        plan_family: 'place' | 'pro'
        plan_id: string
        status: string
        ops_status: 'active' | 'expiring_soon' | 'grace' | 'past_due'
        payment_provider: string
        stripe_subscription_id: string | null
        current_period_end: string | null
        cancel_at_period_end: boolean
        billing_partner: boolean
        billing_featured: boolean
        updated_at: string | null
        target_label: string
      }>
      meta: {
        family: string
        sort: string
        order: string
        count: number
      }
    }>
  },
}
