import { NextRequest, NextResponse } from 'next/server'
import { requireCommunityManagerActor } from '@/lib/api-auth'
import {
  assertUserCanManageCommunity,
  setCommunityMemberRole,
  type CommunityRole,
} from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const communityId = parseInt(idStr, 10)
    if (!communityId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, communityId, { isAppSiteManager })
    const body = await req.json().catch(() => ({}))
    const userId = Number(body.user_id ?? 0)
    const role = String(body.role ?? '') as CommunityRole
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    await setCommunityMemberRole(communityId, userId, role)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
