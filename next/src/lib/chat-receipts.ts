import { parseMandalaDateTime } from '@/lib/format-datetime'

/** Accusé d’envoi / lecture (conversations à deux). */
export type MessageReceiptStatus = 'pending' | 'sent' | 'read'

/**
 * Statut d’une bulle envoyée par moi :
 * - pending : encore en vol (id temporaire)
 * - sent : bien enregistré, pas encore lu par le pair
 * - read : le curseur de lecture du pair a dépassé createdAt
 */
export function messageReceiptStatus(
  createdAt: string | null | undefined,
  peerLastReadAt: string | null | undefined,
  options?: { pending?: boolean },
): MessageReceiptStatus {
  if (options?.pending) return 'pending'
  const created = parseMandalaDateTime(createdAt)
  const readAt = parseMandalaDateTime(peerLastReadAt)
  if (!created || !readAt) return 'sent'
  return created.getTime() <= readAt.getTime() ? 'read' : 'sent'
}

/** Id temporaire d’un message optimistic (pas encore confirmé serveur). */
export function isPendingChatMessageId(id: unknown): boolean {
  const s = String(id ?? '')
  return !s || s.startsWith('tmp-') || !Number.isFinite(Number(s)) || Number(s) <= 0
}
