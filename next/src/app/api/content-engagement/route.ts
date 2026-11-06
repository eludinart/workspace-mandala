/**
 * GET /api/content-engagement?kind=&target_id=
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-auth'
import { isContentEngagementKind } from '@/lib/content-share'
import { isDbConfigured } from '@/lib/db'
import { getContentEngagementBundle } from '@/lib/db-content-engagement'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const kindRaw = req.nextUrl.searchParams.get('kind')
    const targetId = Number(req.nextUrl.searchParams.get('target_id') ?? 0)
    if (!isContentEngagementKind(kindRaw) || !targetId) {
      return NextResponse.json({ error: 'kind et target_id requis' }, { status: 400 })
    }
    const rawUid = getUserIdFromRequest(req)
    const userId = rawUid ? parseInt(rawUid, 10) : null
    const bundle = await getContentEngagementBundle({
      kind: kindRaw,
      targetId,
      userId: userId && userId > 0 ? userId : null,
    })
    return NextResponse.json(bundle)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 400 })
  }
}
