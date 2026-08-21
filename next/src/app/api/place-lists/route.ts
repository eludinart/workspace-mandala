import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import {
  createPlaceListItem,
  listPlaceListItems,
  type PlaceListKind,
} from '@/lib/db-place-lists'
import { requirePlaceOpsAccess } from '@/lib/preview-ops-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const kind = String(req.nextUrl.searchParams.get('kind') ?? '') as PlaceListKind
    const view = (req.nextUrl.searchParams.get('view') ?? 'active') as 'active' | 'history'
    const community_slug = req.nextUrl.searchParams.get('community_slug')
    const { communityId, canManage } = await requirePlaceOpsAccess(req, { communitySlug: community_slug })
    const items = await listPlaceListItems({ communityId, kind, view })
    return NextResponse.json({ items, community_id: communityId, can_manage: canManage })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { uid, communityId, canManage } = await requirePlaceOpsAccess(req, {
      communitySlug: body.community_slug != null ? String(body.community_slug) : null,
      communityId: body.community_id != null ? Number(body.community_id) : null,
    })
    const images = Array.isArray(body.images)
      ? body.images.map((x) => String(x)).filter(Boolean).slice(0, 6)
      : []
    const item = await createPlaceListItem({
      communityId,
      kind: String(body.kind ?? '') as PlaceListKind,
      title: String(body.title ?? ''),
      notes: body.notes != null ? String(body.notes) : null,
      images,
      createdBy: uid,
    })
    return NextResponse.json({ ok: true, item, can_manage: canManage })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
