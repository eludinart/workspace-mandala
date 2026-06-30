/**
 * POST /api/social/message_reaction — ajouter / changer / retirer une réaction emoji
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { toggleMessageReaction } from '@/lib/db-social'
import { isAllowedReactionEmoji } from '@/lib/message-reactions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as { messageId?: number; message_id?: number; emoji?: string }
    const messageId = Number(body.messageId ?? body.message_id ?? 0)
    const emoji = String(body.emoji ?? '').trim()
    const uid = parseInt(userId, 10)

    if (!messageId) {
      return NextResponse.json({ error: 'messageId requis' }, { status: 400 })
    }
    if (!emoji || !isAllowedReactionEmoji(emoji)) {
      return NextResponse.json({ error: 'Émoji non autorisé' }, { status: 400 })
    }
    if (!uid) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const result = await toggleMessageReaction(messageId, uid, emoji)
    return NextResponse.json({
      messageId,
      reactions: result.reactions,
      myEmoji: result.myEmoji,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 400 })
  }
}
