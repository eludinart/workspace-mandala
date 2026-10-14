import { NextRequest, NextResponse } from 'next/server'
import { requireCommunityManagerActor } from '@/lib/api-auth'
import {
  addMemberToCommunityByManager,
  assertUserCanManageCommunity,
  setCommunityMemberCircle,
  setCommunityMemberRole,
  type CommunityRole,
} from '@/lib/db-communities'
import { parseCommunityCircle, type CommunityCircle } from '@/lib/community-role-labels'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const communityId = parseInt(idStr, 10)
    if (!communityId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, communityId, { isAppSiteManager })
    const body = await req.json().catch(() => ({}))
    const userId = Number(body.user_id ?? 0)
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    const result = await addMemberToCommunityByManager(communityId, userId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const communityId = parseInt(idStr, 10)
    if (!communityId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, communityId, { isAppSiteManager })
    const body = await req.json().catch(() => ({}))
    const userId = Number(body.user_id ?? 0)
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    const hasRole = body.role != null && String(body.role) !== ''
    const hasCircle = body.circle != null && String(body.circle) !== ''
    if (!hasRole && !hasCircle) {
      return NextResponse.json({ error: 'role ou circle requis' }, { status: 400 })
    }
    if (hasRole) {
      await setCommunityMemberRole(communityId, userId, String(body.role) as CommunityRole)
    }
    if (hasCircle) {
      const circle = parseCommunityCircle(body.circle)
      if (circle !== String(body.circle)) {
        return NextResponse.json({ error: 'Cercle invalide' }, { status: 400 })
      }
      await setCommunityMemberCircle(communityId, userId, circle as CommunityCircle)
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
