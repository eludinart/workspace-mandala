/** Liste partagée (client + documentation) des e-mails administrateurs Mandala. */
export const MANDALA_ADMIN_EMAILS_DEFAULT = [
  'eludinart@gmail.com',
  'eludinar@gmail.com',
  'elude.in.art@gmail.com',
] as const

export function normalizeAdminEmail(email: string | null | undefined): string {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Parse la liste env. En production sans env → liste vide (pas de fallback hardcodé).
 * En dev, fallback sur la liste documentaire si env absente.
 */
export function parseAdminEmailList(raw: string | undefined | null): string[] {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    if (process.env.NODE_ENV === 'production') return []
    return MANDALA_ADMIN_EMAILS_DEFAULT.map((e) => normalizeAdminEmail(e))
  }
  return trimmed
    .split(',')
    .map((e) => normalizeAdminEmail(e))
    .filter(Boolean)
}

export function isMandalaAdminEmail(
  email: string | null | undefined,
  extraList?: readonly string[]
): boolean {
  const norm = normalizeAdminEmail(email)
  if (!norm) return false
  const list =
    extraList ??
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
      ? parseAdminEmailList(process.env.MANDALA_ADMIN_EMAILS)
      : MANDALA_ADMIN_EMAILS_DEFAULT)
  return (list as readonly string[]).includes(norm)
}
