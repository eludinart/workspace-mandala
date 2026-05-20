import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import {
  getCommunityBySlug,
  listCommunityMembersDisplay,
  requireCommunityMembership,
} from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ members: [] }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim()
    if (!slug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }
    const community = await getCommunityBySlug(slug)
    if (!community) {
      return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    }
    await requireCommunityMembership(uid, community.id)
    const members = await listCommunityMembersDisplay(community.id, uid)
    return NextResponse.json({ members })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
