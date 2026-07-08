'use client'

import { useCallback, useEffect, useState } from 'react'
import { eventsApi } from '@/api/events'
import { EVENT_PHASES, STAFF_ROLES } from '@/lib/event-constants'
import { formatMandalaDateTime } from '@/lib/format-datetime'
import { ApiError } from '@/lib/api-client'
import { WallPublicToggle } from '@/components/wall/WallPublicToggle'

type DetailTab = 'overview' | 'team' | 'tasks' | 'photos'

type EventDetail = {
  event: {
    id: number
    title: string
    description: string | null
    location: string | null
    starts_at: string | null
    ends_at: string | null
    phase: string
    status: string
    cover_image?: string | null
    wall_public?: boolean
  }
  staff: Array<{
    id: number
    user_id: number
    role: string
    note: string | null
    pseudo: string
  }>
  tasks: Array<{
    id: number
    phase: string
    title: string
    is_done: boolean
  }>
  media: Array<{ id: number; image_data: string; caption: string | null }>
  can_manage: boolean
}

type Member = { user_id: number; pseudo: string }

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'team', label: 'Équipe' },
  { id: 'tasks', label: 'Tâches' },
  { id: 'photos', label: 'Photos' },
]

function phaseLabel(id: string) {
  return EVENT_PHASES.find((p) => p.id === id)?.label ?? id
}

function staffRoleLabel(id: string) {
  return STAFF_ROLES.find((r) => r.id === id)?.label ?? id
}

export function EventDetailPage({
  eventId,
  communitySlug,
  onBack,
}: {
  eventId: number
  communitySlug: string
  onBack: () => void
}) {
  const [data, setData] = useState<EventDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState('volunteer')
  const [newTask, setNewTask] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStarts, setEditStarts] = useState('')
  const [editEnds, setEditEnds] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editWallPublic, setEditWallPublic] = useState(false)

  const emitEventsChanged = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('mandala-events-changed', {
        detail: { communitySlug, eventId },
      }),
    )
  }, [communitySlug, eventId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = (await eventsApi.get(eventId)) as EventDetail
      setData(d)
      setEditTitle(d.event.title ?? '')
      setEditDescription(d.event.description ?? '')
      setEditLocation(d.event.location ?? '')
      setEditStarts(d.event.starts_at?.slice(0, 16).replace(' ', 'T') ?? '')
      setEditEnds(d.event.ends_at?.slice(0, 16).replace(' ', 'T') ?? '')
      setEditStatus(d.event.status ?? 'draft')
      setEditWallPublic(!!d.event.wall_public)
      if (d.can_manage) {
        const m = (await eventsApi.communityMembers(communitySlug)) as { members?: Member[] }
        setMembers(m.members ?? [])
      }
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [eventId, communitySlug])

  useEffect(() => {
    void load()
  }, [load])

  const addStaff = async () => {
    const uid = parseInt(addUserId, 10)
    if (!uid) return
    setMsg(null)
    try {
      await eventsApi.addStaff(eventId, { user_id: uid, role: addRole })
      setAddUserId('')
      setMsg('Personne ajoutée à l’équipe')
      void load()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur')
    }
  }

  const removeStaff = async (userId: number) => {
    try {
      await eventsApi.removeStaff(eventId, userId)
      void load()
    } catch {
      /* ignore */
    }
  }

  const addTask = async () => {
    const t = newTask.trim()
    if (!t || !data) return
    try {
      await eventsApi.addTask(eventId, { title: t, phase: data.event.phase })
      setNewTask('')
      void load()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur tâche')
    }
  }

  const toggleTask = async (taskId: number, is_done: boolean) => {
    try {
      await eventsApi.toggleTask(eventId, taskId, is_done)
      void load()
    } catch {
      /* ignore */
    }
  }

  const setPhase = async (phase: string) => {
    try {
      await eventsApi.update(eventId, { phase })
      await load()
      emitEventsChanged()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur')
    }
  }

  const readAsDataUrl = useCallback(async (file: File): Promise<string> => {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('Lecture fichier impossible'))
      reader.readAsDataURL(file)
    })
  }, [])

  const uploadCover = useCallback(
    async (file: File | null) => {
      if (!file) return
      setMsg(null)
      try {
        const dataUrl = await readAsDataUrl(file)
        await eventsApi.update(eventId, { cover_image: dataUrl })
        await load()
        emitEventsChanged()
      } catch (e: unknown) {
        setMsg(e instanceof ApiError ? e.detail : 'Erreur photo')
      }
    },
    [eventId, load, emitEventsChanged, readAsDataUrl],
  )

  const uploadGalleryFiles = useCallback(
    async (files: File[]) => {
      if (!data?.can_manage) return
      const images = files.filter((f) => /^image\//.test(f.type))
      if (images.length === 0) return
      setMsg(`Ajout de ${images.length} photo(s)…`)
      try {
        for (const file of images) {
          const dataUrl = await readAsDataUrl(file)
          await eventsApi.addMedia(eventId, { image_data: dataUrl })
        }
        await load()
        emitEventsChanged()
        setMsg(null)
      } catch (e: unknown) {
        setMsg(e instanceof ApiError ? e.detail : 'Erreur galerie')
      }
    },
    [data?.can_manage, eventId, emitEventsChanged, load, readAsDataUrl],
  )

  // Permet de coller plusieurs images depuis le presse-papiers sur l'onglet "Photos".
  useEffect(() => {
    if (!data?.can_manage || tab !== 'photos') return
    let inFlight = false
    const onPaste = (ev: ClipboardEvent) => {
      if (inFlight) return
      const items = ev.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        // Sur les navigateurs récents, les images sont exposées en tant que "file".
        if (item?.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length === 0) return

      ev.preventDefault()
      inFlight = true
      void (async () => {
        try {
          await uploadGalleryFiles(files)
        } finally {
          inFlight = false
        }
      })()
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [data?.can_manage, tab, uploadGalleryFiles])

  if (loading) return <p className="text-slate-400 text-sm">Chargement…</p>
  if (error || !data) return <p className="text-red-400 text-sm">{error ?? 'Introuvable'}</p>

  const { event, staff, tasks, media, can_manage } = data

  const staffIds = new Set(staff.map((s) => s.user_id))
  const availableMembers = members.filter((m) => !staffIds.has(m.user_id))

  return (
    <div className="max-w-2xl space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-violet-400 hover:underline">
        ← Retour aux événements
      </button>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-sm text-violet-300">{phaseLabel(event.phase)}</p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-slate-800 pb-1" aria-label="Sections événement">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-t-lg text-sm transition-colors ${
              tab === t.id
                ? 'bg-violet-600/30 text-slate-100 border border-b-0 border-violet-600/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      {tab === 'overview' && (
        <div className="space-y-6 pt-2">
          {event.cover_image && (
            <img
              src={event.cover_image}
              alt=""
              className="w-full max-h-48 object-cover rounded-xl border border-slate-800"
            />
          )}
          {can_manage && (
            <label className="text-xs text-slate-500 block">
              Photo de couverture
              <input
                type="file"
                accept="image/*"
                className="mt-1 text-sm"
                onChange={(e) => void uploadCover(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {!can_manage && event.description && (
            <p className="text-slate-300 text-sm leading-relaxed">{event.description}</p>
          )}
          <dl className="grid sm:grid-cols-2 gap-2 text-sm text-slate-400">
            <div>
              <dt className="text-slate-500">Lieu</dt>
              <dd>{event.location || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Début</dt>
              <dd>{formatMandalaDateTime(event.starts_at)}</dd>
            </div>
            {event.ends_at && (
              <div>
                <dt className="text-slate-500">Fin</dt>
                <dd>{formatMandalaDateTime(event.ends_at)}</dd>
              </div>
            )}
          </dl>
          {can_manage && (
            <form
              className="space-y-2 rounded-xl border border-slate-800 p-3 text-sm"
              onSubmit={(e) => {
                e.preventDefault()
                const title = editTitle.trim()
                if (!title) {
                  setMsg('Titre requis')
                  return
                }
                void eventsApi
                  .update(eventId, {
                    title,
                    description: editDescription.trim() || null,
                    location: editLocation || null,
                    starts_at: editStarts ? editStarts.replace('T', ' ') : null,
                    ends_at: editEnds ? editEnds.replace('T', ' ') : null,
                    status: editStatus,
                    wall_public: editWallPublic,
                  })
                  .then(async () => {
                    await load()
                    emitEventsChanged()
                  })
                  .catch((err: unknown) =>
                    setMsg(err instanceof ApiError ? err.detail : 'Erreur mise à jour'),
                  )
              }}
            >
              <p className="text-xs text-slate-500 uppercase tracking-wide">Informations</p>
              <label className="block">
                <span className="text-slate-500 text-xs">Titre</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-slate-500 text-xs">Description</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-slate-500 text-xs">Lieu</span>
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-slate-500 text-xs">Début</span>
                <input
                  type="datetime-local"
                  value={editStarts}
                  onChange={(e) => setEditStarts(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-slate-500 text-xs">Fin (optionnel, pour événements sur plusieurs jours)</span>
                <input
                  type="datetime-local"
                  value={editEnds}
                  onChange={(e) => setEditEnds(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-slate-500 text-xs">Statut</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                >
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                  <option value="cancelled">Annulé</option>
                  <option value="completed">Terminé</option>
                </select>
              </label>
              <WallPublicToggle
                id="wall-public-event"
                checked={editWallPublic}
                onChange={setEditWallPublic}
              />
              <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white">
                Enregistrer
              </button>
            </form>
          )}
          {can_manage && (
            <div className="flex flex-wrap gap-2">
              {EVENT_PHASES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void setPhase(p.id)}
                  className={`text-xs px-2 py-1 rounded-lg border ${
                    event.phase === p.id
                      ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'team' && (
        <section className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold">Équipe</h2>
          {staff.length === 0 && <p className="text-slate-500 text-sm italic">Aucune personne assignée.</p>}
          <ul className="space-y-2">
            {staff.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{s.pseudo}</p>
                  <p className="text-xs text-slate-500">{staffRoleLabel(s.role)}</p>
                </div>
                {can_manage && (
                  <button
                    type="button"
                    onClick={() => void removeStaff(s.user_id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
          {can_manage && (
            <div className="flex flex-wrap gap-2 items-end border border-dashed border-slate-700 rounded-xl p-3">
              <label className="text-xs text-slate-500 flex-1 min-w-[140px]">
                Ajouter une personne
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
                >
                  <option value="">— Choisir —</option>
                  {availableMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.pseudo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Rôle
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="mt-1 block rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void addStaff()}
                disabled={!addUserId}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'tasks' && (
        <section className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold">Tâches</h2>
          {EVENT_PHASES.filter((p) => p.id !== 'closed').map((phase) => {
            const phaseTasks = tasks.filter((t) => t.phase === phase.id)
            if (phaseTasks.length === 0 && !can_manage) return null
            return (
              <div key={phase.id} className="space-y-2">
                <h3 className="text-sm font-medium text-slate-400">{phase.label}</h3>
                <ul className="space-y-1">
                  {phaseTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      {can_manage ? (
                        <input
                          type="checkbox"
                          checked={t.is_done}
                          onChange={(e) => void toggleTask(t.id, e.target.checked)}
                          className="rounded"
                        />
                      ) : (
                        <span>{t.is_done ? '✓' : '○'}</span>
                      )}
                      <span className={t.is_done ? 'line-through text-slate-500' : ''}>{t.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {can_manage && (
            <div className="flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Nouvelle tâche…"
                className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void addTask()}
                className="px-3 py-2 rounded-lg border border-violet-600 text-violet-300 text-sm"
              >
                + Tâche
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'photos' && (
        <section className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold">Galerie photos</h2>
          {can_manage && (
            <>
              <div className="text-xs text-slate-500">
                Astuce : vous pouvez aussi coller plusieurs images depuis le presse-papiers.
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  void uploadGalleryFiles(files)
                }}
                className="text-sm"
              />
            </>
          )}
          {media.length === 0 && !can_manage && (
            <p className="text-slate-500 text-sm italic">Aucune photo.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {media.map((m) => (
              <div key={m.id} className="relative rounded-lg overflow-hidden border border-slate-800">
                <img src={m.image_data} alt="" className="w-full aspect-square object-cover" />
                {can_manage && (
                  <button
                    type="button"
                    onClick={() => {
                      void eventsApi
                        .removeMedia(eventId, m.id)
                        .then(async () => {
                          await load()
                          emitEventsChanged()
                        })
                    }}
                    className="absolute top-1 right-1 text-xs bg-black/60 px-1 rounded text-red-300"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
