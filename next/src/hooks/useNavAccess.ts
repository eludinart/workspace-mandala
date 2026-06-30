import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import { useManagedPlaces } from '@/hooks/useManagedPlaces'
import { isCommunityManagerRole } from '@/lib/community-role-labels'
import { isSiteManagerAppRole, normalizeAppRole } from '@/lib/app-roles'

/** Droits d’affichage du menu (utilisateur / gestionnaire / administrateur). */
export function useNavAccess() {
  const { isRealAdmin, showAdminUi, actingRole, user } = useAuth()
  const { active } = useCommunity()
  const { managedPlaces, loadingManagedPlaces } = useManagedPlaces()

  return useMemo(() => {
    const appRole = normalizeAppRole(user?.app_role)
    const managesActive = isCommunityManagerRole(active?.role)
    let canManageActiveCommunity = managesActive
    let canManageAnyPlace =
      managedPlaces.length > 0 || isSiteManagerAppRole(appRole)

    let showSiteManagerNav = canManageAnyPlace
    const isAppAdmin = showAdminUi

    let roleLabel = 'Membre'
    if (isAppAdmin) {
      roleLabel = managesActive ? 'Administrateur · gestionnaire' : 'Administrateur · membre'
    } else if (showSiteManagerNav) {
      roleLabel = managesActive ? 'Gestionnaire' : 'Gestionnaire · membre'
    }

    /** Simulation développeur : masquer les menus selon le rôle effectif choisi. */
    if (isRealAdmin && actingRole === 'user') {
      showSiteManagerNav = false
      canManageActiveCommunity = false
      canManageAnyPlace = false
      roleLabel = 'Membre'
    } else if (isRealAdmin && actingRole === 'site_manager') {
      showSiteManagerNav = true
      canManageAnyPlace = managedPlaces.length > 0 || true
      roleLabel = managesActive ? 'Gestionnaire' : 'Gestionnaire · membre'
    }

    const managedCommunities = managedPlaces.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      role: 'organizer' as const,
      logo_emoji: p.logo_emoji,
    }))

    return {
      isAppAdmin,
      isRealAdmin,
      isSiteManager: showSiteManagerNav,
      canManageActiveCommunity,
      canManageAnyPlace,
      managedCommunities,
      loadingManagedPlaces,
      activeCommunityName: active?.name ?? null,
      managesActiveCommunity: managesActive,
      roleLabel,
    }
  }, [
    active,
    actingRole,
    isRealAdmin,
    managedPlaces,
    loadingManagedPlaces,
    showAdminUi,
    user?.app_role,
  ])
}
