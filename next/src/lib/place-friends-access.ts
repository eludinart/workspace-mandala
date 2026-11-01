/**
 * Qui peut lire le graphe « lieux amis » pour la carte / fiche.
 * - listed-public : arêtes accepted entre lieux catalogue (landing, visiteurs)
 * - all-accepted : tous les amis accepted (porte lieux_lies)
 */
export type PlaceFriendsAccessMode = 'listed-public' | 'all-accepted' | 'none'

export function resolvePlaceFriendsAccess(params: {
  sourceListedPublic: boolean
  isAuthenticated: boolean
  hasLieuxLiesDoor: boolean
}): { mode: PlaceFriendsAccessMode; can_view: boolean } {
  if (params.hasLieuxLiesDoor && params.isAuthenticated) {
    return { mode: 'all-accepted', can_view: true }
  }
  if (params.sourceListedPublic) {
    return { mode: 'listed-public', can_view: true }
  }
  return { mode: 'none', can_view: false }
}
