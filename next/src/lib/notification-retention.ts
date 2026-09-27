/** Lectures conservées trois mois, puis retirées de l'affichage et de la base. */
export const READ_NOTIFICATION_RETENTION_DAYS = 90

/** Plafond de lectures gardées par personne : les plus récentes. */
export const READ_NOTIFICATION_KEEP_COUNT = 100

/** Dans la cloche, les dernières lues restent sous les non lues. */
export const BELL_READ_PREVIEW_LIMIT = 8

/** Sur la page Centre d'alertes, tout l'historique conservé. */
export const PAGE_READ_PREVIEW_LIMIT = READ_NOTIFICATION_KEEP_COUNT

/** Messages de chat : badge Messages + push, pas la liste des alertes. */
const CHAT_NOTIFICATION_TYPES = new Set([
  'chat_new_message',
  'chat_message',
  'clairiere_message',
])

export function isChatNotification(type?: string | null, sourceType?: string | null): boolean {
  const t = String(type ?? '').toLowerCase()
  const source = String(sourceType ?? '').toLowerCase()
  if (source === 'clairiere_channel') return true
  if (CHAT_NOTIFICATION_TYPES.has(t)) return true
  return t.includes('chat') || t.includes('clairiere')
}

type ReadFlag = { read_at?: string | null }

/** Non lues d'abord, puis un aperçu des lectures les plus récentes. */
export function splitNotificationsForDisplay<T extends ReadFlag>(
  items: T[],
  readLimit: number
): { unread: T[]; read: T[] } {
  const unread: T[] = []
  const read: T[] = []
  for (const item of items) {
    if (!item.read_at) {
      unread.push(item)
      continue
    }
    if (read.length < readLimit) read.push(item)
  }
  return { unread, read }
}
