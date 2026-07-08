'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { placeAnnouncementsApi, type PlaceAnnouncement } from '@/api/place-announcements'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import {
  AnnouncementEditorForm,
  PlaceAnnouncementCard,
} from '@/components/place/PlaceAnnouncementCard'

export function PlaceAnnouncementsPage({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const { active } = useCommunity()
  const [announcements, setAnnouncements] = useState<PlaceAnnouncement[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<PlaceAnnouncement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [wallPublicBusyId, setWallPublicBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await placeAnnouncementsApi.list(active.slug, 50)
      setAnnouncements(res.announcements ?? [])
      setCanManage(!!res.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur')
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void load()
  }, [load])

  if (!canManage && !loading) {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-slate-400 text-sm">Accès réservé aux organisateurs du lieu.</p>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-sm text-violet-400 hover:underline"
        >
          ← Retour à l&apos;accueil
        </button>
      </div>
    )
  }

  const handleCreate = async (data: {
    title: string
    body: string
    image_data: string | null
    wall_public: boolean
  }) => {
    if (!active?.slug) return
    setSubmitting(true)
    try {
      await placeAnnouncementsApi.create({ community_slug: active.slug, ...data })
      setComposerOpen(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (data: {
    title: string
    body: string
    image_data: string | null
    wall_public: boolean
  }) => {
    if (!editing) return
    setSubmitting(true)
    try {
      await placeAnnouncementsApi.update(editing.id, data)
      setEditing(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette annonce ?')) return
    setRemovingId(id)
    try {
      await placeAnnouncementsApi.remove(id)
      if (editing?.id === id) setEditing(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur')
    } finally {
      setRemovingId(null)
    }
  }

  const handleWallPublicChange = async (id: number, wall_public: boolean) => {
    setWallPublicBusyId(id)
    setError(null)
    try {
      await placeAnnouncementsApi.update(id, { wall_public })
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Erreur')
    } finally {
      setWallPublicBusyId(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-sm text-violet-400 hover:underline mb-2"
        >
          ← Accueil
        </button>
        <h1 className="text-2xl font-bold">Annonces du lieu</h1>
        <p className="text-slate-400 text-sm mt-1">
          Messages importants affichés sur l&apos;accueil de <strong className="text-slate-200">{active?.name}</strong>
          — distincts des événements et des alertes personnelles.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!composerOpen && !editing && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="text-sm px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-500"
        >
          + Nouvelle annonce
        </button>
      )}

      {composerOpen && (
        <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
          <h2 className="text-sm font-semibold text-amber-200 mb-3">Nouvelle annonce</h2>
          <AnnouncementEditorForm
            submitLabel="Publier"
            busy={submitting}
            onSubmit={handleCreate}
            onCancel={() => setComposerOpen(false)}
          />
        </section>
      )}

      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}

      <ul className="space-y-4">
        {announcements.map((a) => (
          <li
            key={a.id}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
          >
            {editing?.id === a.id ? (
              <AnnouncementEditorForm
                initialTitle={a.title}
                initialBody={a.body}
                initialImage={a.image_data}
                initialWallPublic={a.wall_public}
                submitLabel="Enregistrer"
                busy={submitting}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <PlaceAnnouncementCard
                announcement={a}
                canManage
                onEdit={() => {
                  setComposerOpen(false)
                  setEditing(a)
                }}
                onDelete={() => void handleDelete(a.id)}
                onWallPublicChange={(next) => void handleWallPublicChange(a.id, next)}
                wallPublicBusy={wallPublicBusyId === a.id}
                deleting={removingId === a.id}
              />
            )}
          </li>
        ))}
      </ul>

      {!loading && announcements.length === 0 && (
        <p className="text-slate-500 text-sm">Aucune annonce publiée.</p>
      )}
    </div>
  )
}
