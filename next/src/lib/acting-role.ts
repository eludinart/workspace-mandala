export type ActingRole = 'admin' | 'site_manager' | 'user'

export const ACTING_ROLE_STORAGE_KEY = 'mdl_admin_acting_role'

export const ACTING_ROLE_LABELS: Record<ActingRole, string> = {
  admin: 'Administrateur',
  site_manager: 'Gestionnaire',
  user: 'Utilisateur',
}

export function parseActingRole(raw: string | null): ActingRole {
  if (raw === 'site_manager' || raw === 'coach') return 'site_manager'
  if (raw === 'user') return 'user'
  return 'admin'
}

export function readActingRoleFromStorage(): ActingRole {
  if (typeof window === 'undefined') return 'admin'
  return parseActingRole(sessionStorage.getItem(ACTING_ROLE_STORAGE_KEY))
}

export function writeActingRoleToStorage(role: ActingRole): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(ACTING_ROLE_STORAGE_KEY, role)
}
