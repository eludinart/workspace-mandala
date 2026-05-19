import { NextResponse } from 'next/server'
import { isDbConfigured, testConnection } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const dbOk = isDbConfigured() && (await testConnection())
  return NextResponse.json({
    ok: true,
    api: 'mandala',
    db: dbOk ? 'connected' : 'disconnected',
  })
}
