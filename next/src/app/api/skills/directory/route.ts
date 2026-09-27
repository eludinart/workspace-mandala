import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCommunityBySlug } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { listSkillDirectory } from '@/lib/db-skills'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const view = req.nextUrl.searchParams.get('view') === 'mandala' ? 'mandala' : 'place'
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim() ?? ''
    let communityId: number | null = null
    if (view === 'place') {
      if (!slug) {
        return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
      }
      const community = await getCommunityBySlug(slug)
      if (!community) return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
      communityId = community.id
    }
    const cards = await listSkillDirectory({
      viewerId: parseInt(userId, 10),
      view,
      communityId,
      query: req.nextUrl.searchParams.get('q') ?? '',
      tag: req.nextUrl.searchParams.get('tag') ?? '',
    })
    return NextResponse.json({ cards })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
