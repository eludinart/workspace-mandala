/**
 * POST /api/content-engagement/reaction
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isContentEngagementKind } from '@/lib/content-share'
import { isDbConfigured } from '@/lib/db'
import { toggleContentReaction } from '@/lib/db-content-engagement'
import { isAllowedReactionEmoji } from '@/lib/message-reactions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 400 })
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json()) as {
      kind?: string
      target_id?: number
      targetId?: number
      emoji?: string
    }
    const kind = body.kind
    const targetId = Number(body.target_id ?? body.targetId ?? 0)
    const emoji = String(body.emoji ?? '').trim()

    if (!isContentEngagementKind(kind) || !targetId) {
      return NextResponse.json({ error: 'kind et target_id requis' }, { status: 400 })
    }
    if (!emoji || !isAllowedReactionEmoji(emoji)) {
      return NextResponse.json({ error: 'Émoji non autorisé' }, { status: 400 })
    }

    const result = await toggleContentReaction({ kind, targetId, userId: uid, emoji })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 400 })
  }
}
