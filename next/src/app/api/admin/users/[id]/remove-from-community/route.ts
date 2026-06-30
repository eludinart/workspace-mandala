import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireUserManagementAccess } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getCommunityBySlug, removeUserFromCommunity } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { id } = await params
    const targetId = parseInt(id, 10)
    if (!targetId) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const communitySlug = String(body.community_slug ?? '').trim()
    if (!communitySlug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }

    await requireUserManagementAccess(req, targetId, communitySlug)

    const community = await getCommunityBySlug(communitySlug)
    if (!community) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }

    await removeUserFromCommunity(community.id, targetId)

    return NextResponse.json({
      ok: true,
      community_slug: communitySlug,
      community_name: community.name,
    })
  } catch (err: unknown) {
    const e = err as ApiError
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
