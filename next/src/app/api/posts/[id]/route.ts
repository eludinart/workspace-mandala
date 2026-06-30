import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { deleteCommunityPost } from '@/lib/db-posts'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id } = await ctx.params
    const postId = parseInt(id, 10)
    if (!postId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })

    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    await deleteCommunityPost({ postId, userId: uid, isAppSiteManager })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
