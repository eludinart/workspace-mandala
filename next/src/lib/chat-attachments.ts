/** Pièces jointes des messages (photos et documents). Partagé client / serveur. */

export type ChatAttachmentMeta = {
  mime: string
  name: string
  size: number
}

export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_CHAT_DOC_BYTES = 15 * 1024 * 1024

export const CHAT_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.txt,.rtf,.doc,.docx,.xls,.xlsx,.odt'

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

const DOC_MIME = new Set([
  'application/pdf',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
])

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
}

const PREVIEWABLE_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function resolveChatFileMime(file: { type: string; name: string }): string {
  let mime = file.type.trim().toLowerCase()
  if (mime === 'image/jpg' || mime === 'image/pjpeg') mime = 'image/jpeg'
  if (mime && mime !== 'application/octet-stream') return mime
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? ''
}

export function chatFileKind(mime: string): 'image' | 'document' | null {
  if (IMAGE_MIME.has(mime)) return 'image'
  if (DOC_MIME.has(mime)) return 'document'
  return null
}

export function isChatImagePreview(mime: string): boolean {
  return PREVIEWABLE_IMAGE.has(mime)
}

export function chatFileError(file: { type: string; name: string; size: number }): string | null {
  const mime = resolveChatFileMime(file)
  const kind = chatFileKind(mime)
  if (!kind) {
    return 'Format non accepté. Utilisez une photo (JPEG, PNG, WebP, GIF) ou un document (PDF, Word, Excel, texte).'
  }
  const max = kind === 'image' ? MAX_CHAT_IMAGE_BYTES : MAX_CHAT_DOC_BYTES
  if (file.size <= 0) return 'Fichier vide.'
  if (file.size > max) {
    return `Fichier trop lourd (${Math.round(max / (1024 * 1024))} Mo maximum).`
  }
  return null
}

export function safeAttachmentName(name: string): string {
  const base = name.replace(/[/\\]/g, '').replace(/[\u0000-\u001f]/g, '').trim()
  return (base || 'fichier').slice(0, 180)
}

export function formatFileSize(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export function messageMediaUrl(messageId: number, download = false): string {
  const base = `/api/social/messages/${messageId}/media`
  return download ? `${base}?download=1` : base
}
