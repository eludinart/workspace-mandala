/**
 * GET /api/moderation/blocks — ids bloqués par moi
 * POST /api/moderation/blocks — bloquer { user_id }
 * DELETE /api/moderation/blocks — débloquer { user_id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import {
  blockUser,
  listBlockedIds,
  unblockUser,
} from '@/lib/db-moderation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const ids = await listBlockedIds(parseInt(userId, 10))
    return NextResponse.json({ blocked_ids: ids })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const target = parseInt(String(body.user_id ?? ''), 10)
    if (!target) return NextResponse.json({ error: 'user_id requis' }, { status: 422 })
    await blockUser(parseInt(userId, 10), target)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 400
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const target = parseInt(req.nextUrl.searchParams.get('user_id') ?? '', 10)
    if (!target) return NextResponse.json({ error: 'user_id requis' }, { status: 422 })
    await unblockUser(parseInt(userId, 10), target)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
