/**
 * POST /api/place-links — Relier mon lieu à un autre (pending).
 * Body: { from_community_id, to_community_id }
 *
 * GET /api/place-links?to_community_id= — statut vers une cible (pour UI carte).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { listCommunitiesManagedByUser } from '@/lib/db-communities'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import {
  linkStatusTowardTarget,
  requestPlaceLink,
} from '@/lib/db-place-links'

export const dynamic = 'force-dynamic'

async function isAppAdmin(userId: number): Promise<boolean> {
  try {
    const user = await authMe(userId)
    const role = String(user.app_role || user.wp_role || '').toLowerCase()
    return role === 'admin' || role === 'administrator'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const toId = parseInt(req.nextUrl.searchParams.get('to_community_id') || '', 10)
    if (!toId) {
      return NextResponse.json({ error: 'to_community_id requis' }, { status: 422 })
    }

    const doorOk = await canAccessFeatureDoor(uid, 'lieux_lies')
    if (!doorOk) {
      return NextResponse.json({
        can_link: false,
        status: 'none',
        from_community_id: null,
        link_id: null,
        managed: [],
      })
    }

    const managed = await listCommunitiesManagedByUser(uid)
    const managedIds = managed.map((c) => c.id)
    const linkableFrom = managed.filter((c) => c.id !== toId)
    const status = await linkStatusTowardTarget({
      managedCommunityIds: managedIds,
      targetCommunityId: toId,
    })

    return NextResponse.json({
      // Peut proposer un lien dès qu’un autre lieu géré existe (y compris cible = lieu géré).
      can_link: linkableFrom.length > 0,
      managed: linkableFrom.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
      target_is_managed: managedIds.includes(toId),
      ...status,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const fromCommunityId = parseInt(String(body.from_community_id ?? ''), 10)
    const toCommunityId = parseInt(String(body.to_community_id ?? ''), 10)
    if (!fromCommunityId || !toCommunityId) {
      return NextResponse.json(
        { error: 'from_community_id et to_community_id requis' },
        { status: 422 }
      )
    }

    const link = await requestPlaceLink({
      userId: uid,
      fromCommunityId,
      toCommunityId,
      isAppAdmin: await isAppAdmin(uid),
    })

    return NextResponse.json({ ok: true, link })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status =
      e instanceof ApiError
        ? e.status
        : typeof e.status === 'number'
          ? e.status
          : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
