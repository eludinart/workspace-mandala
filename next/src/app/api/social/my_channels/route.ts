/**
 * GET /api/social/my_channels
 * Charge les canaux de dialogue (La Clairière) depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getMyChannels } from '@/lib/db-social'
import { requireAuth } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ channels: [] }, { status: 200 })
    }

    let communityId: number | undefined
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim()
    if (slug) {
      const community = await getCommunityBySlug(slug)
      if (!community) {
        return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
      }
      await requireCommunityMembership(parseInt(userId, 10), community.id)
      communityId = community.id
    }

    const data = await getMyChannels(userId, { communityId })
    return NextResponse.json({ channels: data.channels })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
