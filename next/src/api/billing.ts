import { api } from '@/lib/api-client'

export type BillingProduct = {
  product_id: string
  plan_id: string
  plan_family: 'place' | 'pro'
  label: string
  amount_cents: number
  unit: string
  configured: boolean
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
      places: Array<Record<string, unknown>>
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
}
