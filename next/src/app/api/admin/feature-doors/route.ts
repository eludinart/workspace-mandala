/**
 * GET /api/admin/feature-doors — liste des portes
 * PUT /api/admin/feature-doors — met à jour une porte
 * Body PUT: { feature_key, audience, named_user_ids?: number[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import {
  listFeatureDoors,
  updateFeatureDoor,
} from '@/lib/db-feature-doors'
import {
  isFeatureDoorAudience,
  isFeatureDoorKey,
} from '@/lib/feature-door-constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const doors = await listFeatureDoors()
    return NextResponse.json({ doors })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const featureKey = body.feature_key
    const audience = body.audience
    if (!isFeatureDoorKey(featureKey)) {
      return NextResponse.json({ error: 'feature_key invalide' }, { status: 422 })
    }
    if (!isFeatureDoorAudience(audience)) {
      return NextResponse.json({ error: 'audience invalide' }, { status: 422 })
    }
    const namedRaw = Array.isArray(body.named_user_ids) ? body.named_user_ids : []
    const namedUserIds = namedRaw
      .map((x: unknown) => parseInt(String(x), 10))
      .filter((n: number) => Number.isFinite(n) && n > 0)

    const door = await updateFeatureDoor({
      featureKey,
      audience,
      namedUserIds,
      updatedBy: parseInt(userId, 10),
    })
    return NextResponse.json({ ok: true, door })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
