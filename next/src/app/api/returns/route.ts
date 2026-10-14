import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserIdFromRequest } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  createReturn,
  listEventReturns,
  listMyInbox,
  listPersonReturns,
  listPlaceReturns,
  type ReturnScores,
  type ReturnTarget,
} from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

function viewer(req: NextRequest): number | null {
  const raw = getUserIdFromRequest(req)
  const id = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(id) && id > 0 ? id : null
}

function scoresFrom(body: Record<string, unknown>): ReturnScores {
  return {
    clarity: parseInt(String(body.clarity ?? ''), 10),
    frame: parseInt(String(body.frame ?? ''), 10),
    quality: parseInt(String(body.quality ?? ''), 10),
    recommend: body.recommend === true || body.recommend === 1 || body.recommend === '1' || body.recommend === 'true',
    body: String(body.body ?? ''),
  }
}

function jsonError(err: unknown) {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const params = req.nextUrl.searchParams
    if (params.get('mine') === '1') {
      const { userId } = await requireAuth(req)
      return NextResponse.json(await listMyInbox(parseInt(userId, 10)))
    }
    const target = params.get('target')
    if (target === 'place') {
      const slug = params.get('community_slug') ?? ''
      return NextResponse.json(await listPlaceReturns(viewer(req), slug))
    }
    if (target === 'event') {
      const { userId } = await requireAuth(req)
      const eventId = parseInt(params.get('event_id') ?? '', 10)
      return NextResponse.json(await listEventReturns(parseInt(userId, 10), eventId))
    }
    if (target === 'person') {
      const subject = parseInt(params.get('user_id') ?? '', 10)
      return NextResponse.json(await listPersonReturns(viewer(req), subject))
    }
    return NextResponse.json({ error: 'Cible inconnue' }, { status: 400 })
  } catch (err: unknown) {
    return jsonError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as Record<string, unknown>
    const target = String(body.target ?? '') as ReturnTarget
    if (target !== 'place' && target !== 'event' && target !== 'accompaniment') {
      return NextResponse.json({ error: 'Cible inconnue' }, { status: 400 })
    }
    await createReturn({
      viewerId: parseInt(userId, 10),
      target,
      communitySlug: body.community_slug != null ? String(body.community_slug) : undefined,
      eventId: body.event_id != null ? parseInt(String(body.event_id), 10) : undefined,
      occasionDate: body.occasion_date != null ? String(body.occasion_date) : undefined,
      accompanimentId: body.accompaniment_id != null ? parseInt(String(body.accompaniment_id), 10) : undefined,
      scores: scoresFrom(body),
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return jsonError(err)
  }
}
