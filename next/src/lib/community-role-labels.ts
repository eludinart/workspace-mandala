import type { CommunityRole } from './db-communities'

const MANAGER_ROLES = new Set<CommunityRole>(['organizer', 'admin'])

export function isCommunityManagerRole(role: string | undefined | null): boolean {
  return MANAGER_ROLES.has(String(role ?? '').toLowerCase() as CommunityRole)
}

/** Libellé français du rôle sur un lieu (évite la confusion avec « admin » application). */
export function formatCommunityRoleLabel(role: string | undefined | null): string {
  const r = String(role ?? '').toLowerCase()
  if (r === 'organizer') return 'Gestionnaire'
  if (r === 'admin') return 'Gestionnaire'
  if (r === 'member') return 'Membre'
  return r || '—'
}
