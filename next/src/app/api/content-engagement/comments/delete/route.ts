/**
 * POST /api/content-engagement/comments/delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { deleteContentComment } from '@/lib/db-content-engagement'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 400 })
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json()) as { comment_id?: number; commentId?: number }
    const commentId = Number(body.comment_id ?? body.commentId ?? 0)
    if (!commentId) {
      return NextResponse.json({ error: 'comment_id requis' }, { status: 400 })
    }

    const priv = await resolveCommunityManagerAccess(uid)
    await deleteContentComment({
      commentId,
      userId: uid,
      isAppSiteManager: priv.isAppSiteManager,
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 400 })
  }
}
