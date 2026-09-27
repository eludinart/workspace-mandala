export const RESOURCE_SCOPES = ['hidden', 'places', 'mandala'] as const
export type ResourceScope = (typeof RESOURCE_SCOPES)[number]

export const RESOURCE_KINDS = [
  { id: 'recipe', label: 'Recette', mode: 'text' },
  { id: 'text', label: 'Texte', mode: 'text' },
  { id: 'video', label: 'Vidéo', mode: 'file' },
  { id: 'audio', label: 'Audio', mode: 'file' },
  { id: 'song', label: 'Chanson', mode: 'file' },
  { id: 'document', label: 'Document', mode: 'file' },
  { id: 'other', label: 'Autre', mode: 'file' },
] as const

export type ResourceKind = (typeof RESOURCE_KINDS)[number]['id']
export type ResourceMode = (typeof RESOURCE_KINDS)[number]['mode']

export const MAX_RESOURCE_TITLE = 160
export const MAX_RESOURCE_SUMMARY = 280
export const MAX_RESOURCE_BODY = 20_000
export const MAX_RESOURCE_TAGS = 12
export const MAX_RESOURCE_IMAGES = 8

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_PDF_BYTES = 25 * 1024 * 1024
export const MAX_AUDIO_BYTES = 80 * 1024 * 1024
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
])
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const PDF_MIME = new Set(['application/pdf'])

export function isResourceScope(v: unknown): v is ResourceScope {
  return v === 'hidden' || v === 'places' || v === 'mandala'
}

export function isResourceKind(v: unknown): v is ResourceKind {
  return RESOURCE_KINDS.some((k) => k.id === v)
}

export function resourceKindMeta(kind: ResourceKind) {
  return RESOURCE_KINDS.find((k) => k.id === kind) ?? RESOURCE_KINDS[1]
}

export function resourceLabelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}

export function maxBytesForMime(mime: string): number {
  if (IMAGE_MIME.has(mime)) return MAX_IMAGE_BYTES
  if (PDF_MIME.has(mime)) return MAX_PDF_BYTES
  if (AUDIO_MIME.has(mime)) return MAX_AUDIO_BYTES
  if (VIDEO_MIME.has(mime)) return MAX_VIDEO_BYTES
  return 0
}

export function isAllowedFileMime(kind: ResourceKind, mime: string): boolean {
  if (kind === 'video') return VIDEO_MIME.has(mime)
  if (kind === 'audio' || kind === 'song') return AUDIO_MIME.has(mime)
  if (kind === 'document') return PDF_MIME.has(mime)
  if (kind === 'other') return VIDEO_MIME.has(mime) || AUDIO_MIME.has(mime) || PDF_MIME.has(mime) || IMAGE_MIME.has(mime)
  return false
}

export function isAllowedImageMime(mime: string): boolean {
  return IMAGE_MIME.has(mime)
}

export function formatByteLimit(n: number): string {
  return `${Math.round(n / (1024 * 1024))} Mo`
}
