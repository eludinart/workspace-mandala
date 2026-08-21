import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import {
  listCircleSessionMarkers,
  upsertCircleSession,
  type CircleSlot,
} from '@/lib/db-circle-journal'
import { requirePlaceOpsAccess } from '@/lib/preview-ops-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const community_slug = req.nextUrl.searchParams.get('community_slug')
    const ym = String(req.nextUrl.searchParams.get('ym') ?? '')
    const { communityId, canManage } = await requirePlaceOpsAccess(req, { communitySlug: community_slug })
    const markers = await listCircleSessionMarkers({ communityId, ym })
    return NextResponse.json({ community_id: communityId, ym, markers, can_manage: canManage })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { uid, communityId } = await requirePlaceOpsAccess(
      req,
      {
        communitySlug: body.community_slug != null ? String(body.community_slug) : null,
        communityId: body.community_id != null ? Number(body.community_id) : null,
      },
      { manageOnly: true }
    )
    const session = await upsertCircleSession({
      communityId,
      day: String(body.day ?? ''),
      slot: String(body.slot ?? '') as CircleSlot,
      title: body.title != null ? String(body.title) : null,
      summary: body.summary != null ? String(body.summary) : null,
      image_data: body.image_data != null ? String(body.image_data) : null,
      userId: uid,
    })
    return NextResponse.json({ ok: true, session })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
