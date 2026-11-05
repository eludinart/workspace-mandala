import type { ResourceKind } from '@/lib/resource-constants'

/** Couvertures SVG par défaut (public/) — remplacées si `has_cover`. */
const DEFAULT_COVERS: Record<ResourceKind, string> = {
  text: '/resources/covers/text.svg',
  recipe: '/resources/covers/recipe.svg',
  video: '/resources/covers/video.svg',
  audio: '/resources/covers/audio.svg',
  song: '/resources/covers/song.svg',
  document: '/resources/covers/document.svg',
  other: '/resources/covers/other.svg',
}

export function resourceDefaultCoverUrl(kind: ResourceKind): string {
  return DEFAULT_COVERS[kind] ?? DEFAULT_COVERS.other
}
