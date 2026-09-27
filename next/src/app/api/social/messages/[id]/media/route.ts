import { Readable } from 'stream'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getMessageMedia } from '@/lib/db-social'
import { openUploadStream, uploadStat } from '@/lib/resource-files'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return new NextResponse('Backend non configuré', { status: 503 })
    const { userId } = await requireAuth(req)
    const { id } = await ctx.params
    const messageId = parseInt(id, 10)
    if (!messageId) return new NextResponse('Introuvable', { status: 404 })
    const viewerId = parseInt(userId, 10)
    const media = await getMessageMedia(messageId, viewerId)
    if (!media) return new NextResponse('Introuvable', { status: 404 })

    const { size, abs } = await uploadStat(media.path)
    const download = req.nextUrl.searchParams.get('download') === '1'
    const inlineImage = media.mime.startsWith('image/') && !download
    const disposition = inlineImage ? 'inline' : 'attachment'
    const filename = encodeURIComponent(media.name || 'fichier')
    const stream = openUploadStream(abs)
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': media.mime,
        'Content-Length': String(size),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${filename}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const denied = /autoris|introuvable/i.test(e.message ?? '')
    return new NextResponse(denied ? 'Introuvable' : (e.message ?? 'Erreur'), {
      status: denied ? 404 : (e.status ?? 500),
    })
  }
}
