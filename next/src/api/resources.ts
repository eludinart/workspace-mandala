import { api, ApiError, getAuthToken, getResolvedApiBase } from '@/lib/api-client'
import type { ResourceKind, ResourceScope } from '@/lib/resource-constants'

export type ResourceCard = {
  id: number
  author_id: number
  author_pseudo: string
  author_avatar_emoji: string
  kind: ResourceKind
  title: string
  summary: string
  scope: ResourceScope
  downloadable: boolean
  has_cover: boolean
  has_file: boolean
  file_mime: string | null
  file_name: string | null
  tags: string[]
  is_mine: boolean
  created_at: string | null
}

export type ResourceDetail = ResourceCard & {
  body_text: string
  image_ids: number[]
  places: Array<{ id: number; slug: string; name: string }>
}

export function resourceMediaUrl(
  id: number,
  which: 'file' | 'cover' | 'image',
  opts?: { imageId?: number; download?: boolean }
): string {
  const q = new URLSearchParams({ which })
  if (opts?.imageId) q.set('image', String(opts.imageId))
  if (opts?.download) q.set('download', '1')
  return `${getResolvedApiBase()}/api/resources/${id}/media?${q}`
}

export type ResourceDraft = {
  kind: ResourceKind
  title: string
  summary: string
  body_text: string
  scope: ResourceScope
  downloadable: boolean
  place_ids: number[]
  tags: string[]
  file: File | null
  cover: File | null
  clear_cover: boolean
  images: File[]
  remove_image_ids: number[]
}

function draftForm(draft: ResourceDraft): FormData {
  const form = new FormData()
  form.set('kind', draft.kind)
  form.set('title', draft.title)
  form.set('summary', draft.summary)
  form.set('body_text', draft.body_text)
  form.set('scope', draft.scope)
  form.set('downloadable', draft.downloadable ? '1' : '0')
  form.set('place_ids', JSON.stringify(draft.place_ids))
  form.set('tags', JSON.stringify(draft.tags))
  form.set('clear_cover', draft.clear_cover ? '1' : '0')
  form.set('remove_image_ids', JSON.stringify(draft.remove_image_ids))
  if (draft.file) form.set('file', draft.file)
  if (draft.cover) form.set('cover', draft.cover)
  for (const image of draft.images) form.append('images', image)
  return form
}

async function sendForm(path: string, method: 'POST' | 'PATCH', draft: ResourceDraft): Promise<ResourceDetail> {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${getResolvedApiBase()}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: draftForm(draft),
    signal: AbortSignal.timeout(180_000),
  })
  const raw = await res.text()
  let data: { resource?: ResourceDetail; error?: string } = {}
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {}
  } catch {
    data = {}
  }
  if (!res.ok || !data.resource) {
    throw new ApiError(res.status, data.error || 'Envoi impossible', raw)
  }
  return data.resource
}

export const resourcesApi = {
  list: (params: { view: 'place' | 'mandala'; communitySlug?: string }) => {
    const q = new URLSearchParams({ view: params.view })
    if (params.communitySlug) q.set('community_slug', params.communitySlug)
    return api.get(`/api/resources?${q}`) as Promise<{ cards: ResourceCard[] }>
  },
  mine: () => api.get('/api/resources?mine=1') as Promise<{ cards: ResourceCard[] }>,
  publicList: (communitySlug?: string) => {
    const q = communitySlug ? `?community_slug=${encodeURIComponent(communitySlug)}` : ''
    return api.get(`/api/resources/public${q}`) as Promise<{ cards: ResourceCard[] }>
  },
  get: (id: number) => api.get(`/api/resources/${id}`) as Promise<{ resource: ResourceDetail }>,
  create: (draft: ResourceDraft) => sendForm('/api/resources', 'POST', draft),
  update: (id: number, draft: ResourceDraft) => sendForm(`/api/resources/${id}`, 'PATCH', draft),
  remove: (id: number) => api.delete(`/api/resources/${id}`) as Promise<{ ok: boolean }>,
}
