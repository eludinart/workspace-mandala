import { NextRequest, NextResponse } from 'next/server'
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/web-push-send'

export const dynamic = 'force-dynamic'

/** Clé publique VAPID pour PushManager.subscribe (sans auth). */
export async function GET(_req: NextRequest) {
  const publicKey = getVapidPublicKey()
  return NextResponse.json({
    publicKey,
    configured: isWebPushConfigured() && !!publicKey,
  })
}
