import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import {
  dismissExplainScreen,
  EXPLAIN_COPY,
  EXPLAIN_SCREENS,
  isExplainScreen,
  listDismissedExplainScreens,
} from '@/lib/db-explain-cards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const doorOpen = await canAccessFeatureDoor(uid, 'aide_contextuelle')
    const dismissed = doorOpen ? await listDismissedExplainScreens(uid) : EXPLAIN_SCREENS.slice()
    return NextResponse.json({
      door_open: doorOpen,
      dismissed,
      copy: EXPLAIN_COPY,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as { screen?: string }
    const screen = String(body.screen ?? '')
    if (!isExplainScreen(screen)) {
      return NextResponse.json({ error: 'Écran inconnu' }, { status: 422 })
    }
    const dismissed = await dismissExplainScreen(uid, screen)
    return NextResponse.json({ ok: true, dismissed })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
