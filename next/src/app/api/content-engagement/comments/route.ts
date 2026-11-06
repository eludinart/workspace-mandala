/**
 * POST /api/content-engagement/comments — ajouter un commentaire
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isContentEngagementKind } from '@/lib/content-share'
import { isDbConfigured } from '@/lib/db'
import { addContentComment } from '@/lib/db-content-engagement'

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
      body?: string
    }
    const kind = body.kind
    const targetId = Number(body.target_id ?? body.targetId ?? 0)
    const text = String(body.body ?? '')

    if (!isContentEngagementKind(kind) || !targetId) {
      return NextResponse.json({ error: 'kind et target_id requis' }, { status: 400 })
    }

    const comment = await addContentComment({
      kind,
      targetId,
      userId: uid,
      body: text,
    })
    return NextResponse.json({ comment })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 400 })
  }
}
