/**
 * GET/POST /api/cron/billing-comp-reminders
 * Auth : Bearer MANDALA_CRON_SECRET (ou CRON_SECRET).
 * À planifier quotidiennement (Hermes / Coolify) pour les rappels cadeau Lieu.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processCompPlaceExpiryReminders } from '@/lib/billing-comp-lifecycle'

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
  const result = await processCompPlaceExpiryReminders()
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
