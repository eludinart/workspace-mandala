import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-auth'
import { getCommunityBySlug } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { listResourcesForViewer } from '@/lib/db-resources'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ cards: [] }, { status: 503 })
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim() ?? ''
    let communityId: number | null = null
    if (slug) {
      const community = await getCommunityBySlug(slug)
      if (!community) return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
      communityId = community.id
    }
    const userIdStr = getUserIdFromRequest(req)
    const viewerId = userIdStr ? parseInt(userIdStr, 10) : 0
    const cards = await listResourcesForViewer({
      viewerId: viewerId > 0 ? viewerId : 0,
      view: slug ? 'place' : 'mandala',
      communityId,
      publicAccess: true,
    })
    return NextResponse.json({ cards: cards.map((c) => ({ ...c, is_mine: c.author_id === viewerId })) })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
