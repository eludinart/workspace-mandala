import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { clearTelemetryEvents, listTelemetryEvents } from '@/lib/db-telemetry'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { searchParams } = new URL(req.url)
    const items = await listTelemetryEvents({
      fromIso: searchParams.get('from') || undefined,
      toIso: searchParams.get('to') || undefined,
      eventName: searchParams.get('event') || undefined,
      limit: parseInt(searchParams.get('limit') || '200', 10),
    })
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req)
    await clearTelemetryEvents()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}
