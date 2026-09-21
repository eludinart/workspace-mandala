/** Rôles applicatifs Mandala (globaux). Le gestionnaire d’un lieu est un rôle communauté, pas un rôle app. */

export type AppRole = 'user' | 'site_manager' | 'admin'

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  user: 'Membre',
  site_manager: 'Gestionnaire',
  admin: 'Administrateur',
}

/** Rôles assignables dans l’admin (user / admin). Le gestionnaire se définit par lieu. */
export const ASSIGNABLE_APP_ROLES = ['user', 'admin'] as const

/** Ancien slug `coach` → legacy `site_manager` (n’accorde plus de droits globaux). */
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

/** Rôle application réellement assignable (l’ancien site_manager se comporte comme user). */
export function assignableAppRole(role: unknown): 'user' | 'admin' {
  return normalizeAppRole(role) === 'admin' ? 'admin' : 'user'
}
