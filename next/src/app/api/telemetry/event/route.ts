import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-auth'
import { insertTelemetryEvents } from '@/lib/db-telemetry'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ ok: true, inserted: 0 })
    const body = await req.json().catch(() => ({}))
    const batch = Array.isArray(body.events) ? body.events : body.name ? [body] : []
    const userId = getUserIdFromRequest(req)
    const uid = userId ? parseInt(userId, 10) : null
    const now = new Date().toISOString()
    const rows = batch
      .map((ev: Record<string, unknown>) => {
        const name = String(ev.name ?? ev.event_name ?? '').trim()
        if (!name || !/^[a-z0-9_]{2,80}$/.test(name)) return null
        return {
          ts: String(ev.ts ?? now),
          event_name: name,
          user_id: uid,
          anon_id: ev.anon_id ? String(ev.anon_id).slice(0, 64) : null,
          path: ev.path ? String(ev.path).slice(0, 255) : null,
          feature: ev.feature ? String(ev.feature).slice(0, 64) : null,
          env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          properties: (ev.properties as Record<string, unknown>) ?? {},
        }
      })
      .filter(Boolean) as Parameters<typeof insertTelemetryEvents>[0]
    const inserted = await insertTelemetryEvents(rows)
    return NextResponse.json({ ok: true, inserted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur télémétrie'
    if (process.env.NODE_ENV !== 'production') {
      console.error('[telemetry/event]', message, err)
    }
    return NextResponse.json({ ok: false, error: message, inserted: 0 })
  }
}
