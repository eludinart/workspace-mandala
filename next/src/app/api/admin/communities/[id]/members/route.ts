import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { setCommunityMemberCircle, setCommunityMemberRole, type CommunityRole } from '@/lib/db-communities'
import { parseCommunityCircle, type CommunityCircle } from '@/lib/community-role-labels'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id: idStr } = await ctx.params
    const communityId = parseInt(idStr, 10)
    if (!communityId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
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
