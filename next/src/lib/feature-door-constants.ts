/**
 * Clés de portes Suite Mandala — défaut : administrateurs uniquement.
 */
export const FEATURE_DOOR_KEYS = [
  'lieux_lies',
  'seuil',
  'carte_membres',
  'aide_contextuelle',
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
}

export function isFeatureDoorKey(v: unknown): v is FeatureDoorKey {
  return FEATURE_DOOR_KEYS.includes(v as FeatureDoorKey)
}

export function isFeatureDoorAudience(v: unknown): v is FeatureDoorAudience {
  return FEATURE_DOOR_AUDIENCES.includes(v as FeatureDoorAudience)
}
