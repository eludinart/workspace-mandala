'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import { placeListsApi, type PlaceListKind } from '@/api/place-ops'
import { ApiError } from '@/lib/api-client'
import { compressAvatarImage } from '@/lib/compress-avatar-image'

type ListItem = {
  id: number
  title: string
  notes: string | null
  claimed_by: number | null
  claimed_by_pseudo: string | null
  claims?: Array<{ user_id: number; pseudo: string; bring_date: string | null }>
  photos?: Array<{ id: number; image_data: string }>
  bring_date: string | null
  status: string
  brought_at?: string | null
  archived_at?: string | null
  allows_multi_claim?: boolean
  created_by?: number
}

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LABELS: Record<PlaceListKind, { title: string; hint: string; add: string }> = {
  courses: {
    title: 'Courses',
    hint: 'Liste partagée — cochez ce que vous apportez et indiquez la date.',
    add: 'Ajouter un besoin',
  },
  logistics: {
    title: 'Logistique',
    hint: 'Besoins et chantiers du lieu — description, photos, plusieurs personnes peuvent s’engager.',
    add: 'Nouveau besoin',
  },
}

export function PlaceListPage({ kind }: { kind: PlaceListKind }) {
  const { active } = useCommunity()
  const { user } = useAuth()
  const viewerId =
    user && (user as { id?: string | number }).id != null
      ? Number((user as { id: string | number }).id)
      : null
  const meta = LABELS[kind]
  const isLogistics = kind === 'logistics'
  const [view, setView] = useState<'active' | 'history'>('active')
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [draftPhotos, setDraftPhotos] = useState<string[]>([])
  const [canManage, setCanManage] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setError(null)
    try {
      const data = (await placeListsApi.list(active.slug, kind, view)) as {
        items?: ListItem[]
        can_manage?: boolean
      }
      setItems(data.items ?? [])
      setCanManage(!!data.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Chargement impossible')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug, kind, view])

  useEffect(() => {
    void load()
  }, [load])

  const pickPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const next = [...draftPhotos]
    for (const file of Array.from(files)) {
      if (next.length >= 6) break
      const { dataUrl, error: err } = await compressAvatarImage(file, 160_000)
      if (err || !dataUrl) {
        setError(err || 'Image invalide')
        continue
      }
      next.push(dataUrl)
    }
    setDraftPhotos(next)
  }

  const addItem = async () => {
    if (!active?.slug || !title.trim()) return
    setError(null)
    try {
      await placeListsApi.create({
        community_slug: active.slug,
        kind,
        title: title.trim(),
        notes: notes.trim() || undefined,
        images: isLogistics ? draftPhotos : undefined,
      })
      setTitle('')
      setNotes('')
      setDraftPhotos([])
      setShowForm(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Ajout impossible')
    }
  }

  const runAction = async (
    id: number,
    action:
      | 'claim'
      | 'unclaim'
      | 'set_date'
      | 'brought'
      | 'defer'
      | 'update_details'
      | 'add_photos'
      | 'remove_photo',
    extra?: { bring_date?: string; notes?: string | null; images?: string[]; photo_id?: number }
  ) => {
    if (!active?.slug) return
    setBusyId(id)
    setError(null)
    try {
      await placeListsApi.action(id, {
        community_slug: active.slug,
        action,
        ...extra,
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Action impossible')
    } finally {
      setBusyId(null)
    }
  }

  if (!active) {
    return (
      <div className="max-w-2xl mx-auto text-sm text-slate-400">
        Choisissez un lieu actif pour gérer {meta.title.toLowerCase()}.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">{meta.title}</h1>
        <p className="text-sm text-slate-400 mt-1">{meta.hint}</p>
        <p className="text-xs text-slate-500 mt-1">Lieu : {active.name}</p>
      </div>

      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1 self-start w-fit">
        <button
          type="button"
          onClick={() => setView('active')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            view === 'active' ? 'bg-violet-600 text-white' : 'text-slate-400'
          }`}
        >
          À faire
        </button>
        <button
          type="button"
          onClick={() => setView('history')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            view === 'history' ? 'bg-violet-600 text-white' : 'text-slate-400'
          }`}
        >
          Historique
        </button>
      </div>

      {view === 'active' && (
        <div className="space-y-2">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-300 hover:border-violet-500/50 hover:text-slate-100"
            >
              + {meta.add}
            </button>
          ) : (
            <form
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void addItem()
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isLogistics ? 'Titre du besoin (ex. Structure pergola)' : 'Quoi apporter ?'
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                autoFocus
              />
              {(isLogistics || notes || true) && (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isLogistics
                      ? 'Description : contexte, outils, accès, consignes…'
                      : 'Précision (optionnel)'
                  }
                  rows={isLogistics ? 3 : 2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              )}
              {isLogistics && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Photos du besoin (max 6)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void pickPhotos(e.target.files)}
                    className="block w-full text-sm text-slate-400"
                  />
                  {draftPhotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {draftPhotos.map((src, i) => (
                        <div key={i} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover border border-slate-700"
                          />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-slate-900 border border-slate-600 text-[10px]"
                            onClick={() => setDraftPhotos((p) => p.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  Publier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setTitle('')
                    setNotes('')
                    setDraftPhotos([])
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-sm text-slate-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-300 border border-rose-800/40 rounded-xl px-3 py-2 bg-rose-950/20">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          {view === 'active' ? 'Liste vide pour le moment.' : 'Pas encore d’historique.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const claims = item.claims?.length
              ? item.claims
              : item.claimed_by != null
                ? [
                    {
                      user_id: item.claimed_by,
                      pseudo: item.claimed_by_pseudo || 'Quelqu’un',
                      bring_date: item.bring_date,
                    },
                  ]
                : []
            const photos = item.photos ?? []
            const multi = item.allows_multi_claim ?? kind === 'logistics'
            const isMine = viewerId != null && claims.some((c) => c.user_id === viewerId)
            const myClaim = viewerId != null ? claims.find((c) => c.user_id === viewerId) : undefined
            const claimedByAnyone = claims.length > 0
            const names = claims
              .map((c) =>
                viewerId != null && c.user_id === viewerId ? `${c.pseudo} (vous)` : c.pseudo
              )
              .join(', ')
            const expanded = expandedId === item.id
            const canEditDetails =
              canManage || (viewerId != null && item.created_by === viewerId) || isMine

            return (
              <li
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  {view === 'active' ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-violet-500"
                      checked={isMine}
                      disabled={busyId === item.id || (!multi && claimedByAnyone && !isMine)}
                      onChange={() =>
                        void runAction(item.id, isMine ? 'unclaim' : 'claim', {
                          bring_date: isMine ? undefined : todayYmd(),
                        })
                      }
                      title={
                        isMine
                          ? 'Annuler mon engagement'
                          : multi
                            ? 'Je m’en occupe aussi'
                            : 'Je m’en occupe'
                      }
                    />
                  ) : (
                    <span className="text-emerald-400 text-sm mt-0.5">✓</span>
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setExpandedId(expanded ? null : item.id)
                      setEditNotes(item.notes ?? '')
                    }}
                  >
                    <p className="font-medium text-slate-100">{item.title}</p>
                    {item.notes && !expanded && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.notes}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {view === 'history'
                        ? item.brought_at
                          ? 'Apporté'
                          : 'Archivé (date dépassée)'
                        : claimedByAnyone
                          ? names
                          : 'Personne engagé'}
                      {photos.length > 0 && ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
                    </p>
                  </button>
                  {photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photos[0].image_data}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  )}
                  {view === 'active' && canManage && (
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:text-rose-300"
                      onClick={() => {
                        if (!active.slug) return
                        void placeListsApi
                          .remove(item.id, active.slug)
                          .then(load)
                          .catch((e: unknown) =>
                            setError(e instanceof ApiError ? e.detail : 'Suppression impossible')
                          )
                      }}
                    >
                      Suppr.
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="pl-7 space-y-3 border-t border-slate-800/80 pt-3">
                    {canEditDetails && view === 'active' ? (
                      <div className="space-y-2">
                        <label className="block text-xs text-slate-400">Description</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                          placeholder="Contexte, outils, accès…"
                        />
                        <button
                          type="button"
                          disabled={busyId === item.id || editNotes === (item.notes ?? '')}
                          onClick={() =>
                            void runAction(item.id, 'update_details', {
                              notes: editNotes.trim() || null,
                            })
                          }
                          className="text-xs px-3 py-1.5 rounded-lg border border-violet-600/40 text-violet-200 disabled:opacity-40"
                        >
                          Enregistrer la description
                        </button>
                      </div>
                    ) : item.notes ? (
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.notes}</p>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Pas de description.</p>
                    )}

                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {photos.map((ph) => (
                          <div key={ph.id} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={ph.image_data}
                              alt=""
                              className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl object-cover border border-slate-700"
                            />
                            {view === 'active' && canEditDetails && (
                              <button
                                type="button"
                                className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-950/80 text-rose-300 opacity-0 group-hover:opacity-100"
                                onClick={() =>
                                  void runAction(item.id, 'remove_photo', { photo_id: ph.id })
                                }
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {view === 'active' && canEditDetails && photos.length < 6 && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Ajouter des photos</label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            void (async () => {
                              const files = e.target.files
                              if (!files?.length) return
                              const imgs: string[] = []
                              for (const file of Array.from(files)) {
                                if (imgs.length + photos.length >= 6) break
                                const { dataUrl, error: err } = await compressAvatarImage(
                                  file,
                                  160_000
                                )
                                if (!err && dataUrl) imgs.push(dataUrl)
                              }
                              if (imgs.length) {
                                await runAction(item.id, 'add_photos', { images: imgs })
                              }
                            })()
                          }}
                          className="block w-full text-sm text-slate-400"
                        />
                      </div>
                    )}
                  </div>
                )}

                {view === 'active' && isMine && (
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    <label className="text-xs text-slate-400 flex items-center gap-2">
                      Date d’apport
                      <input
                        type="date"
                        value={myClaim?.bring_date || item.bring_date || todayYmd()}
                        disabled={busyId === item.id}
                        onChange={(e) => {
                          const next = e.target.value || todayYmd()
                          void runAction(item.id, 'set_date', { bring_date: next })
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void runAction(item.id, 'brought')}
                      className="text-xs px-2 py-1 rounded-lg border border-emerald-700/50 text-emerald-200 hover:bg-emerald-950/30"
                    >
                      Apporté
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void runAction(item.id, 'defer')}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300"
                    >
                      Reporter +1 j
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
