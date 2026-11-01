/**
 * GET /api/billing/products — catalogue public (pas de price_id).
 */
import { NextResponse } from 'next/server'
import { listBillingProducts } from '@/lib/billing-catalog'
import { isBillingPublic } from '@/lib/billing-door'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    billing_public: isBillingPublic(),
    products: listBillingProducts(),
  })
}
