import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCommunityBySlug } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { createResource, listMyResources, listResourcesForViewer } from '@/lib/db-resources'
import { saveUpload } from '@/lib/resource-files'
import {
  isAllowedFileMime,
  isAllowedImageMime,
  isResourceKind,
  isResourceScope,
  maxBytesForMime,
  resourceKindMeta,
} from '@/lib/resource-constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function readFileField(value: FormDataEntryValue | null, mimeOk: (mime: string) => boolean) {
  if (!(value instanceof File) || value.size === 0) return null
  const mime = value.type || 'application/octet-stream'
  if (!mimeOk(mime)) throw Object.assign(new Error(`Type non accepté (${mime || 'inconnu'})`), { status: 400 })
  const max = maxBytesForMime(mime)
  if (!max || value.size > max) {
    throw Object.assign(new Error('Fichier trop lourd pour ce type'), { status: 400 })
  }
  const bytes = Buffer.from(await value.arrayBuffer())
  const stored = await saveUpload(bytes, mime)
  return { path: stored, mime, name: value.name, size: value.size }
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const mine = req.nextUrl.searchParams.get('mine') === '1'
    if (mine) {
      const cards = await listMyResources(parseInt(userId, 10))
      return NextResponse.json({ cards })
    }
    const view = req.nextUrl.searchParams.get('view') === 'mandala' ? 'mandala' : 'place'
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim() ?? ''
    let communityId: number | null = null
    if (view === 'place') {
      if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
      const community = await getCommunityBySlug(slug)
      if (!community) return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
      communityId = community.id
    }
    const cards = await listResourcesForViewer({
      viewerId: parseInt(userId, 10),
      view,
      communityId,
    })
    return NextResponse.json({ cards })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const form = await req.formData()
    const kind = String(form.get('kind') ?? '')
    if (!isResourceKind(kind)) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    const scope = String(form.get('scope') ?? 'hidden')
    if (!isResourceScope(scope)) return NextResponse.json({ error: 'Portée invalide' }, { status: 400 })
    const meta = resourceKindMeta(kind)
    const file =
      meta.mode === 'file'
        ? await readFileField(form.get('file'), (mime) => isAllowedFileMime(kind, mime))
        : null
    const cover = await readFileField(form.get('cover'), isAllowedImageMime)
    const imagePaths: string[] = []
    if (meta.mode === 'text') {
      for (const entry of form.getAll('images')) {
        const saved = await readFileField(entry, isAllowedImageMime)
        if (saved) imagePaths.push(saved.path)
      }
    }
    let placeIds: number[] = []
    try {
      const parsed = JSON.parse(String(form.get('place_ids') ?? '[]'))
      if (Array.isArray(parsed)) placeIds = parsed.map((id) => Number(id)).filter((id) => id > 0)
    } catch {
      placeIds = []
    }
    let tags: string[] = []
    try {
      const parsed = JSON.parse(String(form.get('tags') ?? '[]'))
      if (Array.isArray(parsed)) tags = parsed.map((t) => String(t))
    } catch {
      tags = []
    }
    const resource = await createResource(parseInt(userId, 10), {
      kind,
      title: String(form.get('title') ?? ''),
      summary: String(form.get('summary') ?? ''),
      body_text: String(form.get('body_text') ?? ''),
      scope,
      downloadable: String(form.get('downloadable') ?? '') === '1',
      place_ids: placeIds,
      tags,
      cover_path: cover?.path ?? (file && file.mime.startsWith('image/') ? file.path : null),
      file_path: file?.path ?? null,
      file_mime: file?.mime ?? null,
      file_name: file?.name ?? null,
      file_size: file?.size ?? null,
      image_paths: imagePaths,
    })
    return NextResponse.json({ resource })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
