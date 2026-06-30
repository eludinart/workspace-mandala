/** Rôles applicatifs Mandala (hors rôles par communauté). */

export type AppRole = 'user' | 'site_manager' | 'admin'

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  user: 'Membre',
  site_manager: 'Gestionnaire',
  admin: 'Administrateur',
}

/** Ancien slug `coach` → gestionnaire de lieu. */
export function normalizeAppRole(role: unknown): AppRole {
  const r = String(role ?? '')
    .trim()
    .toLowerCase()
  if (r === 'admin' || r === 'administrator') return 'admin'
  if (r === 'site_manager' || r === 'coach') return 'site_manager'
  return 'user'
}

export function appRoleLabel(role: unknown): string {
  return APP_ROLE_LABELS[normalizeAppRole(role)]
}

export function isSiteManagerAppRole(role: unknown): boolean {
  return normalizeAppRole(role) === 'site_manager'
}
