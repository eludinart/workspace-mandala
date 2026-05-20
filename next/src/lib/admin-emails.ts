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

export function parseAdminEmailList(raw: string | undefined | null): string[] {
  const source = raw?.trim() ? raw : MANDALA_ADMIN_EMAILS_DEFAULT.join(',')
  return source
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
  const list = extraList ?? MANDALA_ADMIN_EMAILS_DEFAULT
  return (list as readonly string[]).includes(norm)
}
