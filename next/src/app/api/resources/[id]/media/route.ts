import { Readable } from 'stream'
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getResourceMedia } from '@/lib/db-resources'
import { openUploadStream, uploadStat } from '@/lib/resource-files'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  weba: 'audio/webm',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
}

function mimeFromPath(filePath: string, fallback: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? fallback
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return new NextResponse('Backend non configuré', { status: 503 })
    const { id } = await ctx.params
    const whichParam = req.nextUrl.searchParams.get('which')
    const which = whichParam === 'cover' || whichParam === 'image' ? whichParam : 'file'
    const imageId = parseInt(req.nextUrl.searchParams.get('image') ?? '', 10)
    const download = req.nextUrl.searchParams.get('download') === '1'
    const userIdStr = getUserIdFromRequest(req)
    const viewerId = userIdStr ? parseInt(userIdStr, 10) : 0
    const media = await getResourceMedia(parseInt(id, 10), viewerId > 0 ? viewerId : 0, which, imageId || undefined)
    if (!media) return new NextResponse('Introuvable', { status: 404 })
    if (download && which === 'file' && !media.downloadable) {
      return new NextResponse('Téléchargement non autorisé', { status: 403 })
    }
    const mime = which === 'file' ? media.mime : mimeFromPath(media.path, 'image/jpeg')
    const { size, abs } = await uploadStat(media.path)
    const range = req.headers.get('range')
    const disposition = download && media.downloadable ? 'attachment' : 'inline'
    const filename = encodeURIComponent(media.name || 'fichier')

    if (range && (mime.startsWith('video/') || mime.startsWith('audio/'))) {
      const match = /bytes=(\d+)-(\d*)/.exec(range)
      const start = match ? parseInt(match[1], 10) : 0
      const end = match && match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024 - 1, size - 1)
      const stream = openUploadStream(abs, start, end)
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `${disposition}; filename="${filename}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }

    const stream = openUploadStream(abs)
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return new NextResponse(e.message ?? 'Erreur', { status: e.status ?? 500 })
  }
}
