/**
 * GET /api/feature-doors/access — quelles portes l’utilisateur peut franchir.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { featureDoorAccessMap } from '@/lib/db-feature-doors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const access = await featureDoorAccessMap(parseInt(userId, 10))
    return NextResponse.json({ access })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
