'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { placeAnnouncementsApi, type PlaceAnnouncement } from '@/api/place-announcements'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { FeedSection } from '@/components/community/FeedSection'
import {
  AnnouncementEditorForm,
  PlaceAnnouncementCard,
} from '@/components/place/PlaceAnnouncementCard'

const HOME_PREVIEW_LIMIT = 3

export function PlaceAnnouncementsSection({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { active } = useCommunity()
  const [announcements, setAnnouncements] = useState<PlaceAnnouncement[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<PlaceAnnouncement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!active?.slug) {
      setAnnouncements([])
      setCanManage(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await placeAnnouncementsApi.list(active.slug, 20)
      setAnnouncements(res.announcements ?? [])
      setCanManage(!!res.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger les annonces')
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (data: { title: string; body: string; image_data: string | null }) => {
    if (!active?.slug) return
    setSubmitting(true)
    setError(null)
    try {
      await placeAnnouncementsApi.create({ community_slug: active.slug, ...data })
      setComposerOpen(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur à la publication')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (data: { title: string; body: string; image_data: string | null }) => {
    if (!editing) return
    setSubmitting(true)
    setError(null)
    try {
      await placeAnnouncementsApi.update(editing.id, data)
      setEditing(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur à la modification')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette annonce ?')) return
    setRemovingId(id)
    setError(null)
    try {
      await placeAnnouncementsApi.remove(id)
      if (editing?.id === id) setEditing(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur à la suppression')
    } finally {
      setRemovingId(null)
    }
  }

  const preview = announcements.slice(0, HOME_PREVIEW_LIMIT)
  const hasMore = announcements.length > HOME_PREVIEW_LIMIT

  if (!loading && announcements.length === 0 && !canManage) {
    return null
  }

  return (
    <FeedSection
      icon="📢"
      title="Annonces du moment"
      subtitle="Messages importants des organisateurs du lieu"
      tone="amber"
      action={
        <div className="flex items-center gap-3">
          {canManage && (
            <button
              type="button"
              onClick={() => onNavigate('place-announcements')}
              className="text-sm text-amber-300 hover:underline font-medium"
            >
              Gérer →
            </button>
          )}
        </div>
      }
    >
      {loading && <p className="text-sm text-slate-500">Chargement…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && announcements.length === 0 && canManage && (
        <p className="text-sm text-slate-500 mb-3">
          Aucune annonce pour le moment. Informez les membres d&apos;une nouvelle importante.
        </p>
      )}

      <div className="space-y-6">
        {preview.map((a, i) => (
          <div key={a.id} className={i > 0 ? 'pt-6 border-t border-amber-900/30' : ''}>
            {editing?.id === a.id ? (
              <AnnouncementEditorForm
                initialTitle={a.title}
                initialBody={a.body}
                initialImage={a.image_data}
                submitLabel="Enregistrer"
                busy={submitting}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <PlaceAnnouncementCard
                announcement={a}
                canManage={canManage}
                onEdit={() => setEditing(a)}
                onDelete={() => void handleDelete(a.id)}
                deleting={removingId === a.id}
              />
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => onNavigate('place-announcements')}
          className="mt-4 text-sm text-amber-300 hover:underline"
        >
          Voir les {announcements.length} annonces →
        </button>
      )}

      {canManage && !composerOpen && !editing && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="mt-4 text-sm px-4 py-2 rounded-xl bg-amber-600/90 text-white hover:bg-amber-500"
        >
          + Nouvelle annonce
        </button>
      )}

      {canManage && composerOpen && (
        <div className="mt-4 pt-4 border-t border-amber-900/30">
          <p className="text-sm font-medium text-amber-200 mb-3">Publier une annonce</p>
          <AnnouncementEditorForm
            submitLabel="Publier"
            busy={submitting}
            onSubmit={handleCreate}
            onCancel={() => setComposerOpen(false)}
          />
        </div>
      )}
    </FeedSection>
  )
}
