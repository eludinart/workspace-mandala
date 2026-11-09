/**
 * GET/POST /api/cron/push-delivery-alerts
 * Auth : Bearer MANDALA_CRON_SECRET (ou CRON_SECRET).
 * Vérifie le taux delivered/accepted + purge > 30j.
 */
import { NextRequest, NextResponse } from 'next/server'
import { runPushDeliveryAlertCheck } from '@/lib/push-admin-alerts'

export const dynamic = 'force-dynamic'

function authorize(req: NextRequest): boolean {
  const expected =
    process.env.MANDALA_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  if (!expected) return false
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${expected}`) return true
  const q = req.nextUrl.searchParams.get('secret')
  return Boolean(q && q === expected)
}

async function run(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const result = await runPushDeliveryAlertCheck()
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
