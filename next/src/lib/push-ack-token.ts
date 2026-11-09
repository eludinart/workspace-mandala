/**
 * Signature HMAC pour les accusés push (SW sans cookie session).
 * Serveur uniquement (Node crypto).
 */
import { createHmac, timingSafeEqual } from 'crypto'

export { platformFromUserAgent, type PushPlatform } from './push-platform'

function ackSecret(): string {
  return (
    process.env.PUSH_ACK_SECRET?.trim() ||
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'mandala-push-ack-dev'
  )
}

export function signPushAck(sendId: number): string {
  const id = Math.floor(Number(sendId))
  return createHmac('sha256', ackSecret()).update(`push-ack:${id}`).digest('base64url')
}

export function verifyPushAck(sendId: number, sig: string | null | undefined): boolean {
  if (!sig || !Number.isFinite(sendId) || sendId <= 0) return false
  const expected = signPushAck(sendId)
  const a = Buffer.from(expected)
  const b = Buffer.from(String(sig))
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
