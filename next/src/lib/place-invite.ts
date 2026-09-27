/** Invitation lieu privé : stockée pour l’inscription / le premier join. */
export const PENDING_PLACE_INVITE_KEY = 'mandala_pending_invite'

export type PendingPlaceInvite = {
  slug: string
  code: string
}

export function readPendingPlaceInvite(): PendingPlaceInvite | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_PLACE_INVITE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPlaceInvite
    if (!parsed?.slug || !parsed?.code) return null
    return { slug: String(parsed.slug).trim().toLowerCase(), code: String(parsed.code).trim() }
  } catch {
    return null
  }
}

export function writePendingPlaceInvite(invite: PendingPlaceInvite | null) {
  if (typeof window === 'undefined') return
  try {
    if (!invite?.slug || !invite?.code) {
      sessionStorage.removeItem(PENDING_PLACE_INVITE_KEY)
      return
    }
    sessionStorage.setItem(
      PENDING_PLACE_INVITE_KEY,
      JSON.stringify({
        slug: invite.slug.trim().toLowerCase(),
        code: invite.code.trim(),
      })
    )
  } catch {
    /* ignore */
  }
}

export function clearPendingPlaceInvite() {
  writePendingPlaceInvite(null)
}

/** Lit ?join=&invite= (ou community=) dans l’URL courante et mémorise l’invitation. */
export function capturePlaceInviteFromUrl(): PendingPlaceInvite | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const slug = (params.get('join') || params.get('community') || '').trim().toLowerCase()
  const code = (params.get('invite') || params.get('invite_code') || '').trim()
  if (!slug || !code) return readPendingPlaceInvite()
  const invite = { slug, code }
  writePendingPlaceInvite(invite)
  return invite
}
