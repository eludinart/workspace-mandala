/**
 * GET /api/social/clairiere_unread_count
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getClairiereUnreadSummary, type ClairiereUnreadPlace } from '@/lib/db-social'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const CLAIRIERE_TTL_MS = 30_000
const DB_TIMEOUT_MS = 2_500

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('clairiere_unread_timeout')), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!userId) return NextResponse.json({ count: 0, byCommunity: [] })
    if (!isDbConfigured()) return NextResponse.json({ count: 0, byCommunity: [] })

    const cacheKey = `clairiere_unread:${userId}`
    const cached = cacheGet<{ count: number; byCommunity: ClairiereUnreadPlace[] }>(cacheKey)
    if (cached !== undefined && Array.isArray(cached.byCommunity)) {
      return NextResponse.json(cached)
    }

    const summary = await withTimeout(getClairiereUnreadSummary(userId), DB_TIMEOUT_MS).catch(() => null)
    const payload = {
      count: summary?.total ?? 0,
      byCommunity: summary?.byCommunity ?? [],
    }
    if (summary) cacheSet(cacheKey, payload, CLAIRIERE_TTL_MS)
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ count: 0, byCommunity: [] })
  }
}
