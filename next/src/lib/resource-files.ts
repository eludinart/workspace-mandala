/**
 * Fichiers de ressources sur le disque (vidéos, audios, PDF, images).
 * La base ne garde que le chemin relatif.
 */
import { createReadStream } from 'fs'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export function uploadRoot(): string {
  const configured = process.env.MANDALA_UPLOAD_DIR?.trim()
  if (configured) return path.resolve(configured)
  return path.resolve(process.cwd(), 'data', 'uploads')
}

export function absoluteUploadPath(relativePath: string): string {
  const root = uploadRoot()
  const abs = path.resolve(root, relativePath)
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw Object.assign(new Error('Chemin de fichier invalide'), { status: 400 })
  }
  return abs
}

export async function saveUpload(bytes: Buffer, mime: string): Promise<string> {
  const ext = EXT_BY_MIME[mime]
  if (!ext) throw Object.assign(new Error('Type de fichier non accepté'), { status: 400 })
  const id = randomUUID()
  const relative = path.posix.join(id.slice(0, 2), `${id}.${ext}`)
  const abs = absoluteUploadPath(relative)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, bytes)
  return relative
}

export async function removeUpload(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return
  try {
    await rm(absoluteUploadPath(relativePath), { force: true })
  } catch {
    /* fichier déjà absent */
  }
}

export async function uploadStat(relativePath: string): Promise<{ size: number; abs: string }> {
  const abs = absoluteUploadPath(relativePath)
  const info = await stat(abs)
  return { size: info.size, abs }
}

export function openUploadStream(abs: string, start?: number, end?: number) {
  return createReadStream(abs, start != null && end != null ? { start, end } : undefined)
}

export async function readUpload(relativePath: string): Promise<Buffer> {
  return readFile(absoluteUploadPath(relativePath))
}
