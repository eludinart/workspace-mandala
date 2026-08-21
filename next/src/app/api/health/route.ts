import { NextResponse } from 'next/server'
import { isDbConfigured, testConnection } from '@/lib/db'

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
    return NextResponse.json({
      ok: true,
      api: 'mandala',
      db: 'connected',
    })
  } catch (err) {
    console.error('[GET /api/health]', err)
    return NextResponse.json(
      { ok: false, api: 'mandala', db: 'disconnected' },
      { status: 503 }
    )
  }
}
