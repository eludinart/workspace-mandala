import { NextResponse } from 'next/server'
import { isDbConfigured, testConnection } from '@/lib/db'
import { getLoadSnapshot } from '@/lib/request-metrics'

export const dynamic = 'force-dynamic'

/** Ready probe — 503 si la DB requise est indisponible. */
export async function GET() {
  try {
    const dbOk = isDbConfigured() && (await testConnection())
    if (!dbOk) {
      return NextResponse.json(
        { ok: false, api: 'mandala', db: 'disconnected' },
        { status: 503 }
      )
    }
    const load = getLoadSnapshot()
    return NextResponse.json({
      ok: true,
      api: 'mandala',
      db: 'connected',
      load: {
        rps: load.rps,
        avg_ms: load.avgMs,
        errors: load.errors,
        pool_enqueue_recent: load.poolEnqueueRecent,
      },
    })
  } catch (err) {
    console.error('[GET /api/health]', err)
    return NextResponse.json(
      { ok: false, api: 'mandala', db: 'disconnected' },
      { status: 503 }
    )
  }
}
