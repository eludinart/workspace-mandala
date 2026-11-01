/**
 * POST /api/billing/pro/[userId]/review
 * Body: { decision: 'verified' | 'rejected', reason?: string }
 * Autorisé : admin app OU gestionnaire d’un lieu dont le candidat est membre.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { findEndorsementCommunity, reviewProProfile } from '@/lib/db-billing'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: reviewerId } = await requireAuth(req)
    const reviewerUid = parseInt(reviewerId, 10)
    const { userId: subjectParam } = await ctx.params
    const subjectUid = parseInt(subjectParam, 10)
    if (!subjectUid) {
      return NextResponse.json({ error: 'userId invalide' }, { status: 422 })
    }

    let isAdmin = false
    try {
      const user = await authMe(reviewerUid)
      const role = String(user.app_role || user.wp_role || '').toLowerCase()
      isAdmin = role === 'admin' || role === 'administrator'
    } catch {
      /* ignore */
    }

    let endorsementCommunityId: number | null = null
    if (!isAdmin) {
      endorsementCommunityId = await findEndorsementCommunity(reviewerUid, subjectUid)
      if (!endorsementCommunityId) {
        return NextResponse.json(
          {
            error:
              'Seul un administrateur ou un gestionnaire d’un lieu dont cette personne est membre peut endosser',
          },
          { status: 403 }
        )
      }
    }

    const body = await req.json().catch(() => ({}))
    const decision = String(body.decision ?? '')
    if (decision !== 'verified' && decision !== 'rejected') {
      return NextResponse.json(
        { error: 'decision doit être verified ou rejected' },
        { status: 422 }
      )
    }

    const profile = await reviewProProfile(
      subjectUid,
      decision,
      reviewerUid,
      endorsementCommunityId,
      String(body.reason ?? '')
    )

    return NextResponse.json({ ok: true, profile })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
