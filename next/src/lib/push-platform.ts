/** Détection plateforme depuis User-Agent (safe navigateur + serveur). */

export type PushPlatform = 'ios' | 'android' | 'desktop' | 'unknown'

export function platformFromUserAgent(ua: string | null | undefined): PushPlatform {
  const s = String(ua ?? '').toLowerCase()
  if (!s) return 'unknown'
  if (/iphone|ipad|ipod/.test(s)) return 'ios'
  if (/android/.test(s)) return 'android'
  if (/windows|macintosh|linux|cros/.test(s) && !/mobile/.test(s)) return 'desktop'
  if (/mobile|tablet/.test(s)) return 'android'
  return 'unknown'
}
