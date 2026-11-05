/**
 * POST /api/billing/pro/submit — demande de vérification Mandala Pro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { assertBillingCtaAllowed } from '@/lib/billing-door'
import { upsertProProfileSubmit } from '@/lib/db-billing'
import { seedSkillOfferFromPro } from '@/lib/db-skills'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    let isAdmin = false
    try {
      const user = await authMe(parseInt(userId, 10))
      const role = String(user.app_role || user.wp_role || '').toLowerCase()
      isAdmin = role === 'admin' || role === 'administrator'
    } catch {
      /* ignore */
    }
    assertBillingCtaAllowed(isAdmin)

    const body = await req.json().catch(() => ({}))
    const uid = parseInt(userId, 10)
    const profile = await upsertProProfileSubmit(uid, {
      tagline: String(body.tagline ?? ''),
      modalities: String(body.modalities ?? ''),
      service_area: String(body.service_area ?? ''),
      external_url: String(body.external_url ?? ''),
    })
    await seedSkillOfferFromPro(uid, {
      tagline: String(body.tagline ?? ''),
      modalities: String(body.modalities ?? ''),
      service_area: String(body.service_area ?? ''),
    }).catch(() => {})

    return NextResponse.json({ ok: true, profile })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
