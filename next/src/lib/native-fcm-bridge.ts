/**
 * Pont FCM natif TWA → web.
 * Le token arrive en `?fcm_token=` (et éventuellement cookie `mdl_fcm_token`).
 * MandalaApp réécrit l’historique via buildAppUrl — il faut capturer / préserver
 * ce param AVANT le strip `/app?page=…`.
 */

export const NATIVE_FCM_PARAM = 'fcm_token'
export const NATIVE_FCM_STORAGE = 'mdl_native_fcm_token'
export const NATIVE_FCM_COOKIE = 'mdl_fcm_token'

/** Params à conserver lors des rewrite d’URL app (hors page/nav). */
export const APP_URL_PRESERVE_PARAMS = [NATIVE_FCM_PARAM, 'dist'] as const

const MIN_TOKEN_LEN = 20

export function isPlausibleFcmToken(token: string | null | undefined): boolean {
  const t = (token ?? '').trim()
  return t.length >= MIN_TOKEN_LEN
}

export function readCookieValue(cookieHeader: string, name: string): string {
  if (!cookieHeader) return ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match?.[1]?.trim() || ''
}

/** Extrait le token depuis query + cookie (sans toucher au DOM). */
export function extractNativeFcmToken(input: {
  search?: string
  cookieHeader?: string
  stored?: string | null
}): string {
  const search = input.search ?? ''
  const qs = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(qs)
  const fromQuery = (params.get(NATIVE_FCM_PARAM) ?? '').trim()
  if (isPlausibleFcmToken(fromQuery)) return fromQuery

  const fromCookie = readCookieValue(input.cookieHeader ?? '', NATIVE_FCM_COOKIE)
  if (isPlausibleFcmToken(fromCookie)) return fromCookie

  const stored = (input.stored ?? '').trim()
  if (isPlausibleFcmToken(stored)) return stored
  return ''
}

/**
 * Fusionne les params de navigation app avec les params pont à préserver
 * (ex. fcm_token encore présent dans l’URL courante).
 */
export function mergePreservedAppSearchParams(
  navParams: URLSearchParams,
  currentSearch: string,
  preserveKeys: readonly string[] = APP_URL_PRESERVE_PARAMS
): URLSearchParams {
  const out = new URLSearchParams(navParams.toString())
  const cur = new URLSearchParams(
    currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  )
  for (const key of preserveKeys) {
    if (out.has(key)) continue
    const value = cur.get(key)?.trim()
    if (value) out.set(key, value)
  }
  return out
}

export function buildAppPathWithPreservedBridge(opts: {
  page: string
  extraNav?: Record<string, string | null | undefined>
  currentSearch?: string
}): string {
  const nav = new URLSearchParams()
  nav.set('page', opts.page)
  if (opts.extraNav) {
    for (const [k, v] of Object.entries(opts.extraNav)) {
      if (v != null && String(v).trim()) nav.set(k, String(v))
    }
  }
  const merged = mergePreservedAppSearchParams(nav, opts.currentSearch ?? '')
  return `/app?${merged.toString()}`
}
