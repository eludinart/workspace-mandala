import { NextRequest, NextResponse } from 'next/server'
import { recordPushReceipt } from '@/lib/db-push-receipts'
import { verifyPushAck } from '@/lib/push-ack-token'
import { platformFromUserAgent } from '@/lib/push-platform'

export const dynamic = 'force-dynamic'

type Body = {
  sendId?: number
  sig?: string
  event?: string
  standalone?: boolean
  platform?: string
  userAgent?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const sendId = Number(body.sendId)
    const event = body.event === 'opened' ? 'opened' : body.event === 'delivered' ? 'delivered' : null
    if (!event || !Number.isFinite(sendId) || sendId <= 0) {
      return NextResponse.json({ error: 'sendId et event requis' }, { status: 400 })
    }
    if (!verifyPushAck(sendId, body.sig)) {
      return NextResponse.json({ error: 'signature invalide' }, { status: 401 })
    }

    const headerUa = req.headers.get('user-agent')
    const ua = body.userAgent || headerUa
    const result = await recordPushReceipt({
      sendId,
      event,
      userAgent: ua,
      standalone: typeof body.standalone === 'boolean' ? body.standalone : null,
      platform: body.platform || platformFromUserAgent(ua),
    })
    if (result === 'not_found') {
      return NextResponse.json({ error: 'inconnu' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, result })
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[notifications/push_ack]', e.message ?? err)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 500 })
  }
}
