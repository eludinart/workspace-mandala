import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  adminDismissReport,
  adminRemoveReturn,
  adminSetAlertStatus,
  listAdminQueue,
} from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    await requireAdmin(req)
    return NextResponse.json(await listAdminQueue())
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    await requireAdmin(req)
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? '')
    if (action === 'remove_return') {
      await adminRemoveReturn(parseInt(String(body.return_id ?? ''), 10))
    } else if (action === 'dismiss_report') {
      await adminDismissReport(parseInt(String(body.report_id ?? ''), 10))
    } else if (action === 'alert_status') {
      const status = String(body.status ?? '')
      if (status !== 'read' && status !== 'done') {
        return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
      }
      await adminSetAlertStatus(parseInt(String(body.alert_id ?? ''), 10), status)
    } else {
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
