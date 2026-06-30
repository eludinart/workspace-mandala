import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getCommunityBySlug, removeUserFromCommunity } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const slug = String(body.community_slug ?? '').trim()
    if (!slug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }
    const community = await getCommunityBySlug(slug)
    if (!community) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }
    await removeUserFromCommunity(community.id, uid)
    return NextResponse.json({
      ok: true,
      community_slug: slug,
      community_name: community.name,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
