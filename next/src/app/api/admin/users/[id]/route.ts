import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireUserManagementAccess } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { authMe, updateProfile, updateUserAppRole } from '@/lib/db-auth'
import { listCommunitiesForUser } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { id } = await params
    const targetId = parseInt(id, 10)
    if (!targetId) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

    const communitySlug = req.nextUrl.searchParams.get('community_slug')
    await requireUserManagementAccess(req, targetId, communitySlug)

    const user = await authMe(targetId)
    const communities = await listCommunitiesForUser(targetId)
    const { avatar: _a, ...rest } = user as Record<string, unknown> & { avatar?: string | null }
    return NextResponse.json({
      ...rest,
      has_avatar: !!(user.avatar && String(user.avatar).length > 0),
      communities: communities.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        role: c.role,
        logo_emoji: c.logo_emoji,
      })),
    })
  } catch (err: unknown) {
    const e = err as ApiError
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { id } = await params
    const targetId = parseInt(id, 10)
    if (!targetId) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const communitySlug =
      typeof body.community_slug === 'string' ? body.community_slug : req.nextUrl.searchParams.get('community_slug')
    const { isAdmin } = await requireUserManagementAccess(req, targetId, communitySlug)

    const allowed: Record<string, unknown> = {}
    const profileKeys = [
      'first_name',
      'last_name',
      'show_full_last_name',
      'bio',
      'avatar_emoji',
      'profile_public',
      'coach_headline',
      'coach_short_bio',
    ]
    for (const key of profileKeys) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        allowed[key] = body[key]
      }
    }

    if (!Object.keys(allowed).length && !(isAdmin && body.app_role !== undefined)) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
    }

    if (isAdmin && body.app_role !== undefined) {
      await updateUserAppRole(targetId, String(body.app_role))
    }

    let user = await authMe(targetId)
    if (Object.keys(allowed).length > 0) {
      user = await updateProfile(targetId, allowed)
    }
    const communities = await listCommunitiesForUser(targetId)
    const { avatar: _a, ...rest } = user as Record<string, unknown> & { avatar?: string | null }
    return NextResponse.json({
      ...rest,
      has_avatar: !!(user.avatar && String(user.avatar).length > 0),
      communities: communities.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        role: c.role,
        logo_emoji: c.logo_emoji,
      })),
    })
  } catch (err: unknown) {
    const e = err as ApiError
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
