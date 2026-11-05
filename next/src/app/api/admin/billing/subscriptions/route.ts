/**
 * GET /api/admin/billing/subscriptions
 * Query: family=all|place|pro, scope=active|history|all,
 *        sort=urgency|period_end|family|target|provider|updated_at, order=asc|desc
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import {
  adminBillingOpsUrgency,
  deriveAdminBillingOpsStatus,
  type AdminBillingOpsStatus,
} from '@/lib/admin-billing-ops'
import {
  listAdminBillingSubscriptions,
  type AdminBillingListScope,
  type AdminBillingListSort,
} from '@/lib/db-billing'

export const dynamic = 'force-dynamic'

const SORTS = new Set<AdminBillingListSort>([
  'urgency',
  'period_end',
  'family',
  'target',
  'provider',
  'updated_at',
])

function targetLabel(row: {
  plan_family: string
  community_name: string | null
  user_display_name: string | null
  user_email: string | null
  user_id: number
  community_id: number | null
}): string {
  if (row.plan_family === 'place') {
    return row.community_name || (row.community_id ? `Lieu #${row.community_id}` : 'Lieu')
  }
  return (
    row.user_display_name ||
    row.user_email ||
    `Utilisateur #${row.user_id}`
  )
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const sp = req.nextUrl.searchParams
    const familyRaw = (sp.get('family') || 'all').toLowerCase()
    const family =
      familyRaw === 'place' || familyRaw === 'pro' ? familyRaw : 'all'
    const scopeRaw = (sp.get('scope') || 'active').toLowerCase()
    const scope: AdminBillingListScope =
      scopeRaw === 'history' || scopeRaw === 'all' ? scopeRaw : 'active'
    const sortRaw = (sp.get('sort') || 'urgency').toLowerCase()
    const sort: AdminBillingListSort = SORTS.has(sortRaw as AdminBillingListSort)
      ? (sortRaw as AdminBillingListSort)
      : 'urgency'
    const order = (sp.get('order') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

    const rows = await listAdminBillingSubscriptions({ family, scope })
    const now = new Date()
    const items = rows.map((r) => {
      const ops_status: AdminBillingOpsStatus = deriveAdminBillingOpsStatus(
        {
          status: r.status,
          plan_family: r.plan_family,
          payment_provider: r.payment_provider,
          current_period_end: r.current_period_end,
        },
        now
      )
      return {
        id: r.id,
        user_id: r.user_id,
        user_email: r.user_email,
        user_display_name: r.user_display_name,
        community_id: r.community_id,
        community_name: r.community_name,
        plan_family: r.plan_family,
        plan_id: r.plan_id,
        status: r.status,
        ops_status,
        payment_provider: r.payment_provider,
        stripe_subscription_id: r.stripe_subscription_id,
        current_period_end: r.current_period_end
          ? r.current_period_end.toISOString()
          : null,
        cancel_at_period_end: r.cancel_at_period_end,
        billing_partner: r.billing_partner,
        billing_featured: r.billing_featured,
        updated_at: r.updated_at ? r.updated_at.toISOString() : null,
        target_label: targetLabel(r),
      }
    })

    items.sort((a, b) => {
      let cmp = 0
      switch (sort) {
        case 'urgency':
          cmp =
            adminBillingOpsUrgency(a.ops_status) -
            adminBillingOpsUrgency(b.ops_status)
          if (cmp === 0) {
            const ae = a.current_period_end ? Date.parse(a.current_period_end) : Number.POSITIVE_INFINITY
            const be = b.current_period_end ? Date.parse(b.current_period_end) : Number.POSITIVE_INFINITY
            cmp = ae - be
          }
          break
        case 'period_end': {
          const ae = a.current_period_end ? Date.parse(a.current_period_end) : Number.POSITIVE_INFINITY
          const be = b.current_period_end ? Date.parse(b.current_period_end) : Number.POSITIVE_INFINITY
          cmp = ae - be
          break
        }
        case 'family':
          cmp = a.plan_family.localeCompare(b.plan_family, 'fr')
          break
        case 'target':
          cmp = a.target_label.localeCompare(b.target_label, 'fr', {
            sensitivity: 'base',
          })
          break
        case 'provider':
          cmp = a.payment_provider.localeCompare(b.payment_provider, 'fr')
          break
        case 'updated_at': {
          const ae = a.updated_at ? Date.parse(a.updated_at) : 0
          const be = b.updated_at ? Date.parse(b.updated_at) : 0
          cmp = ae - be
          break
        }
        default: {
          const _exhaustive: never = sort
          void _exhaustive
          cmp = 0
        }
      }
      return order === 'desc' ? -cmp : cmp
    })

    return NextResponse.json({
      items,
      meta: { family, scope, sort, order, count: items.length },
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
