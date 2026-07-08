import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-auth'
import { buildWallFeed } from '@/lib/db-wall-feed'
import { isDbConfigured } from '@/lib/db'
import type { WallFeedSort } from '@/lib/wall-feed-types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const sortParam = req.nextUrl.searchParams.get('sort')
    const sort: WallFeedSort = sortParam === 'place' ? 'place' : 'date'
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '40', 10)

    const userIdStr = getUserIdFromRequest(req)
    const userId = userIdStr ? parseInt(userIdStr, 10) : null

    const feed = await buildWallFeed({
      userId: userId && userId > 0 ? userId : null,
      sort,
      limit: Number.isFinite(limit) ? limit : 40,
    })

    return NextResponse.json({
      items: feed.items,
      sort,
      is_authenticated: feed.is_authenticated,
      member_place_count: feed.member_place_count,
      hidden_count: feed.hidden_count,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
