/**
 * Clés de portes Suite Mandala — défaut : administrateurs uniquement.
 */
export const FEATURE_DOOR_KEYS = [
  'lieux_lies',
  'seuil',
  'carte_membres',
  'aide_contextuelle',
  'mur_engagement',
] as const

export type FeatureDoorKey = (typeof FEATURE_DOOR_KEYS)[number]

export const FEATURE_DOOR_AUDIENCES = [
  'administrateurs',
  'gestionnaires',
  'everyone',
] as const

export type FeatureDoorAudience = (typeof FEATURE_DOOR_AUDIENCES)[number]

export const FEATURE_DOOR_LABELS: Record<FeatureDoorKey, string> = {
  lieux_lies: 'Lieux reliés (Relier / lieux amis)',
  seuil: 'Seuil — écrire à quelqu’un d’un lieu ami',
  carte_membres: 'Carte des membres (ville, points)',
  aide_contextuelle: 'Cartes d’explication',
  mur_engagement: 'Mur — réactions, commentaires, partage',
}

/** Texte d’aide admin — ce que la porte contrôle dans l’app. */
export const FEATURE_DOOR_HELP: Record<FeatureDoorKey, string> = {
  lieux_lies:
    'Ouvre Relier / lieux amis : proposer ou accepter un lien entre lieux, voir le graphe des amis, et accéder aux calendriers / événements partagés entre lieux amis. Déjà branchée dans l’app.',
  seuil:
    'Autorise d’ouvrir un message 1:1 avec quelqu’un d’un lieu ami si conversation déjà ouverte, ou présence calendrier commune récente sur un lieu ami — pas de DM libre hors lieu. Branchée sur l’ouverture de canal.',
  carte_membres:
    'Affiche la carte des villes des membres du lieu (après qu’ils aient indiqué leur ville et accepté d’y figurer). Prompt une fois + carte sur la page Membres.',
  aide_contextuelle:
    'Cartes d’explication une fois par personne et par écran (accueil, membres, messages, calendrier, annuaire). Bouton « Compris » pour ne plus les revoir.',
  mur_engagement:
    'Sous les publications du mur (Agora, annonces, événements) : réagir avec des emoji, commenter, partager un lien ou envoyer dans une conversation. Respecte le mur public pour le partage externe.',
}

export function isFeatureDoorKey(v: unknown): v is FeatureDoorKey {
  return FEATURE_DOOR_KEYS.includes(v as FeatureDoorKey)
}

export function isFeatureDoorAudience(v: unknown): v is FeatureDoorAudience {
  return FEATURE_DOOR_AUDIENCES.includes(v as FeatureDoorAudience)
}
