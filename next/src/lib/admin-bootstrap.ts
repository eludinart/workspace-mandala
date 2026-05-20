import { isMandalaAdminEmail, parseAdminEmailList } from './admin-emails'

/** E-mails toujours traités comme administrateurs applicatifs (variable serveur). */
export function getBootstrapAdminEmails(): string[] {
  return parseAdminEmailList(process.env.MANDALA_ADMIN_EMAILS)
}

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  return isMandalaAdminEmail(email, getBootstrapAdminEmails())
}
