import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { deleteResource, getResourceForViewer, updateResource } from '@/lib/db-resources'
import { saveUpload } from '@/lib/resource-files'
import {
  isAllowedFileMime,
  isAllowedImageMime,
  isResourceScope,
  maxBytesForMime,
} from '@/lib/resource-constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { id } = await ctx.params
    const resourceId = parseInt(id, 10)
    const userIdStr = getUserIdFromRequest(req)
    const viewerId = userIdStr ? parseInt(userIdStr, 10) : 0
    const resource = await getResourceForViewer(resourceId, viewerId > 0 ? viewerId : 0)
    if (!resource) return NextResponse.json({ error: 'Ressource non visible' }, { status: 404 })
    if (resource.scope !== 'mandala' && viewerId <= 0) {
      return NextResponse.json({ error: 'Ressource non visible' }, { status: 404 })
    }
    return NextResponse.json({ resource })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

async function readFileField(value: FormDataEntryValue | null, mimeOk: (mime: string) => boolean) {
  if (!(value instanceof File) || value.size === 0) return null
  const mime = value.type || 'application/octet-stream'
  if (!mimeOk(mime)) throw Object.assign(new Error(`Type non accepté (${mime || 'inconnu'})`), { status: 400 })
  const max = maxBytesForMime(mime)
  if (!max || value.size > max) throw Object.assign(new Error('Fichier trop lourd pour ce type'), { status: 400 })
  const bytes = Buffer.from(await value.arrayBuffer())
  return { path: await saveUpload(bytes, mime), mime, name: value.name, size: value.size }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const { id } = await ctx.params
    const existing = await getResourceForViewer(parseInt(id, 10), parseInt(userId, 10))
    if (!existing?.is_mine) return NextResponse.json({ error: 'Ressource introuvable' }, { status: 404 })
    const form = await req.formData()
    const scope = String(form.get('scope') ?? existing.scope)
    if (!isResourceScope(scope)) return NextResponse.json({ error: 'Portée invalide' }, { status: 400 })
    const file = await readFileField(form.get('file'), (mime) => isAllowedFileMime(existing.kind, mime))
    const cover = await readFileField(form.get('cover'), isAllowedImageMime)
    const imagePaths: string[] = []
    for (const entry of form.getAll('images')) {
      const saved = await readFileField(entry, isAllowedImageMime)
      if (saved) imagePaths.push(saved.path)
    }
    let placeIds: number[] = []
    let tags: string[] = []
    let removeImageIds: number[] = []
    try {
      const parsed = JSON.parse(String(form.get('place_ids') ?? '[]'))
      if (Array.isArray(parsed)) placeIds = parsed.map((n) => Number(n)).filter((n) => n > 0)
    } catch { placeIds = [] }
    try {
      const parsed = JSON.parse(String(form.get('tags') ?? '[]'))
      if (Array.isArray(parsed)) tags = parsed.map((t) => String(t))
    } catch { tags = [] }
    try {
      const parsed = JSON.parse(String(form.get('remove_image_ids') ?? '[]'))
      if (Array.isArray(parsed)) removeImageIds = parsed.map((n) => Number(n)).filter((n) => n > 0)
    } catch { removeImageIds = [] }
    const resource = await updateResource(existing.id, parseInt(userId, 10), {
      kind: existing.kind,
      title: String(form.get('title') ?? ''),
      summary: String(form.get('summary') ?? ''),
      body_text: String(form.get('body_text') ?? ''),
      scope,
      downloadable: String(form.get('downloadable') ?? '') === '1',
      place_ids: placeIds,
      tags,
      cover_path: cover?.path,
      clear_cover: String(form.get('clear_cover') ?? '') === '1',
      file_path: file?.path ?? null,
      file_mime: file?.mime ?? null,
      file_name: file?.name ?? null,
      file_size: file?.size ?? null,
      image_paths: imagePaths,
      remove_image_ids: removeImageIds,
    })
    return NextResponse.json({ resource })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const { id } = await ctx.params
    await deleteResource(parseInt(id, 10), parseInt(userId, 10))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
