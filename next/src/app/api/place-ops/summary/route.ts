import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { listPlaceListItems } from '@/lib/db-place-lists'
import { listCircleSessionMarkers } from '@/lib/db-circle-journal'
import { requirePlaceOpsAccess } from '@/lib/preview-ops-access'

export const dynamic = 'force-dynamic'

function ymFromDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function prevYm(ym: string): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  return `${py}-${String(pm).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const community_slug = req.nextUrl.searchParams.get('community_slug')
    const { communityId, canManage } = await requirePlaceOpsAccess(req, { communitySlug: community_slug })
    const ym = ymFromDate()
    const ymPrev = prevYm(ym)

    const [courses, logistics, markers, markersPrev] = await Promise.all([
      listPlaceListItems({ communityId, kind: 'courses', view: 'active' }),
      listPlaceListItems({ communityId, kind: 'logistics', view: 'active' }),
      listCircleSessionMarkers({ communityId, ym }),
      listCircleSessionMarkers({ communityId, ym: ymPrev }),
    ])

    const sorted = [...markers, ...markersPrev].sort(
      (a, b) => b.day.localeCompare(a.day) || b.slot.localeCompare(a.slot)
    )
    const latest = sorted[0] ?? null

    return NextResponse.json({
      community_id: communityId,
      can_manage: canManage,
      courses_count: courses.length,
      logistics_count: logistics.length,
      courses_preview: courses.slice(0, 3).map((i) => ({
        id: i.id,
        title: i.title,
        claimed_by_pseudo: i.claimed_by_pseudo,
        bring_date: i.bring_date,
      })),
      logistics_preview: logistics.slice(0, 3).map((i) => ({
        id: i.id,
        title: i.title,
        claimed_by_pseudo: i.claimed_by_pseudo,
        bring_date: i.bring_date,
      })),
      latest_circle: latest
        ? { day: latest.day, slot: latest.slot, has_image: latest.has_image, id: latest.id }
        : null,
      ym,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
