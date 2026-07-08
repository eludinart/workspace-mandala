import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userCanManageInCommunity } from '@/lib/api-auth'
import {
  getCommunityById,
  getCommunityBySlug,
  requireCommunityMembership,
} from '@/lib/db-communities'
import { createPost, getPostsByCommunity } from '@/lib/db-posts'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function resolveCommunity(
  req: NextRequest,
  body?: Record<string, unknown>
): Promise<{ id: number }> {
  const fromBody = body?.community_id ?? body?.communityId
  const communityIdParam = fromBody ?? req.nextUrl.searchParams.get('communityId')
  const communitySlug =
    (body?.community_slug as string | undefined) ?? req.nextUrl.searchParams.get('community_slug')

  if (communityIdParam != null && String(communityIdParam).trim() !== '') {
    const id = parseInt(String(communityIdParam), 10)
    if (!id || id < 1) throw Object.assign(new Error('communityId invalide'), { status: 400 })
    const comm = await getCommunityById(id)
    if (!comm) throw Object.assign(new Error('Communauté introuvable'), { status: 404 })
    return { id }
  }
  if (communitySlug) {
    const c = await getCommunityBySlug(String(communitySlug).trim())
    if (!c) throw Object.assign(new Error('Communauté introuvable'), { status: 404 })
    return { id: c.id }
  }
  throw Object.assign(new Error('communityId ou community_slug requis'), { status: 400 })
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ posts: [] }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const community = await resolveCommunity(req)
    const role = await requireCommunityMembership(uid, community.id)
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
    const posts = await getPostsByCommunity(community.id, limit)
    const can_manage = await userCanManageInCommunity(uid, role)
    return NextResponse.json({ community_id: community.id, posts, can_manage })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    const community = await resolveCommunity(req, body)
    const role = await requireCommunityMembership(uid, community.id)
    const can_manage = await userCanManageInCommunity(uid, role)
    const post = await createPost(community.id, uid, {
      type: body.type,
      content: String(body.content ?? ''),
      wall_public: can_manage ? body.wall_public : false,
    })
    return NextResponse.json({ post })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
