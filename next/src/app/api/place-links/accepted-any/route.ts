/**
 * GET /api/place-links/accepted-any?community_ids=1,2
 * True si au moins un des lieux a un ami accepted (pour afficher la case « lieux amis »).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { anyCommunityHasAcceptedFriendLink } from '@/lib/db-place-links'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const raw = req.nextUrl.searchParams.get('community_ids') || ''
    const ids = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0)
    const has = ids.length ? await anyCommunityHasAcceptedFriendLink(ids) : false
    return NextResponse.json({ has_accepted_friend: has })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
