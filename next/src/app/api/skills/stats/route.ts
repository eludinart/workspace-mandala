/**
 * GET /api/skills/stats — vues de ma fiche + statut Pro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { countSkillProfileViews } from '@/lib/db-skills'
import { getProBoostFlagsForUsers, getProProfile } from '@/lib/db-billing'
import { resolveProBilling } from '@/lib/billing-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const [views30d, proBilling, proProfile, flagsMap] = await Promise.all([
      countSkillProfileViews(uid, 30),
      resolveProBilling(uid),
      getProProfile(uid),
      getProBoostFlagsForUsers([uid]),
    ])
    const flags = flagsMap.get(uid)
    return NextResponse.json({
      views_30d: views30d,
      pro_status: proBilling.status,
      plan_id: proBilling.planId,
      verification: proProfile?.verification ?? 'none',
      reject_reason: proProfile?.reject_reason ?? null,
      endorsement_place_name: flags?.endorsement_place_name ?? null,
      tagline: proProfile?.tagline ?? null,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
