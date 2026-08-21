/**
 * Push — envoi via Web Push (VAPID).
 * Ancien nom FCM conservé pour les appels existants (messages Clairière).
 */
import { sendWebPushToUser } from './web-push-send'

export async function sendFcmPush(
  userId: number,
  _email: string | null,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  await sendWebPushToUser(userId, title, body, url ?? null)
}
