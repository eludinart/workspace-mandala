import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import { useManagedPlaces } from '@/hooks/useManagedPlaces'
import { isCommunityManagerRole } from '@/lib/community-role-labels'

/** Droits d’affichage du menu (utilisateur / gestionnaire de lieu / administrateur). */
export function useNavAccess() {
  const { isRealAdmin, showAdminUi, actingRole } = useAuth()
  const { active, communities, loading: communitiesLoading } = useCommunity()
  const { managedPlaces, loadingManagedPlaces } = useManagedPlaces()

  return useMemo(() => {
    const isAppAdmin = showAdminUi
    const managesActive =
      isCommunityManagerRole(active?.role) ||
      managedPlaces.some((p) => p.slug === active?.slug)
    let canManageActiveCommunity = managesActive || isAppAdmin
    let canManageAnyPlace = managedPlaces.length > 0 || isAppAdmin

    let showSiteManagerNav = canManageAnyPlace

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
      canManageAnyPlace = true
      canManageActiveCommunity = true
      roleLabel = managesActive ? 'Gestionnaire' : 'Gestionnaire · membre'
    }

    if (!communitiesLoading && communities.length === 0 && roleLabel === 'Membre') {
      roleLabel = 'Sans lieu'
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
    communities,
    communitiesLoading,
    actingRole,
    isRealAdmin,
    managedPlaces,
    loadingManagedPlaces,
    showAdminUi,
  ])
}
