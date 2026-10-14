import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createAccompaniment } from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as Record<string, unknown>
    await createAccompaniment({
      viewerId: parseInt(userId, 10),
      communitySlug: String(body.community_slug ?? ''),
      companionUserId: parseInt(String(body.companion_user_id ?? ''), 10),
      occasionDate: String(body.occasion_date ?? ''),
      eventId: parseInt(String(body.event_id ?? '0'), 10) || 0,
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
