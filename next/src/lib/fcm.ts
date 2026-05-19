/** Push FCM — optionnel (MVP Mandala : no-op). */
export async function sendFcmPush(
  _userId: number,
  _email: string | null,
  _title: string,
  _body: string,
  _url?: string
): Promise<void> {
  // Intégrer Firebase plus tard si besoin.
}
