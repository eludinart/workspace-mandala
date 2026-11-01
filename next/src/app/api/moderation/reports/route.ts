/**
 * POST /api/moderation/reports — signaler un contenu / utilisateur
 * GET  /api/moderation/reports — liste admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  insertContentReport,
  isContentReasonCode,
  isContentTargetType,
  listContentReports,
} from '@/lib/db-moderation'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const targetType = body.target_type
    const reasonCode = body.reason_code
    const targetId = String(body.target_id ?? '').trim()
    if (!isContentTargetType(targetType)) {
      return NextResponse.json({ error: 'target_type invalide' }, { status: 422 })
    }
    if (!isContentReasonCode(reasonCode)) {
      return NextResponse.json({ error: 'reason_code invalide' }, { status: 422 })
    }
    if (!targetId) {
      return NextResponse.json({ error: 'target_id requis' }, { status: 422 })
    }
    const id = await insertContentReport({
      reporterId: parseInt(userId, 10),
      targetType,
      targetId,
      targetUserId:
        body.target_user_id != null ? parseInt(String(body.target_user_id), 10) : null,
      communityId:
        body.community_id != null ? parseInt(String(body.community_id), 10) : null,
      reasonCode,
      details: body.details != null ? String(body.details) : null,
    })
    return NextResponse.json({ ok: true, id })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const items = await listContentReports()
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
