import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { deleteCircleSession, getCircleSession, type CircleSlot } from '@/lib/db-circle-journal'
import { requirePlaceOpsAccess } from '@/lib/preview-ops-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const community_slug = req.nextUrl.searchParams.get('community_slug')
    const day = String(req.nextUrl.searchParams.get('day') ?? '')
    const slot = String(req.nextUrl.searchParams.get('slot') ?? '') as CircleSlot
    const { communityId, canManage } = await requirePlaceOpsAccess(req, { communitySlug: community_slug })
    const session = await getCircleSession({ communityId, day, slot })
    return NextResponse.json({ session, can_manage: canManage })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const community_slug = req.nextUrl.searchParams.get('community_slug')
    const day = String(req.nextUrl.searchParams.get('day') ?? '')
    const slot = String(req.nextUrl.searchParams.get('slot') ?? '') as CircleSlot
    const { communityId } = await requirePlaceOpsAccess(req, { communitySlug: community_slug }, { manageOnly: true })
    await deleteCircleSession({ communityId, day, slot })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
