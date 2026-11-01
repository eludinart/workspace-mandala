/**
 * Accueil « Prochain rendez-vous » : colonne gauche = média uniquement.
 * Image = cover_image, sinon première photo de la galerie.
 * Sans image → placeholder date (jamais une EventPreviewCard complète).
 */

export type FeaturedProgramMediaKind = 'image' | 'date-placeholder'

export function resolveFeaturedProgramImage(event: {
  cover_image?: string | null
  first_media_image?: string | null
}): string | null {
  const cover = event.cover_image?.trim()
  if (cover) return cover
  const media = event.first_media_image?.trim()
  return media || null
}

export function featuredProgramMediaKind(
  imageUrl: string | null | undefined,
): FeaturedProgramMediaKind {
  return imageUrl?.trim() ? 'image' : 'date-placeholder'
}
