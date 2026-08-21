'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCommunity } from '@/contexts/CommunityContext'
import { circleJournalApi } from '@/api/place-ops'
import { ApiError } from '@/lib/api-client'
import { compressAvatarImage } from '@/lib/compress-avatar-image'
import { addMonths, monthLabelFr, ymToday } from '@/components/calendar/calendar-utils'

type Marker = { id: number; day: string; slot: 'morning' | 'evening'; has_image: boolean }
type Session = {
  id: number
  day: string
  slot: 'morning' | 'evening'
  title: string | null
  summary: string | null
  image_data: string | null
  created_by_pseudo: string | null
}

function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}

function firstWeekdayMonday(ym: string): number {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const d = new Date(y, m - 1, 1)
  return (d.getDay() + 6) % 7
}

export function CirclesJournalPage() {
  const { active } = useCommunity()
  const [ym, setYm] = useState(ymToday)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<'morning' | 'evening'>('morning')
  const [session, setSession] = useState<Session | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)

  const markerMap = useMemo(() => {
    const m = new Map<string, { morning?: boolean; evening?: boolean }>()
    for (const mk of markers) {
      const cur = m.get(mk.day) ?? {}
      if (mk.slot === 'morning') cur.morning = true
      if (mk.slot === 'evening') cur.evening = true
      m.set(mk.day, cur)
    }
    return m
  }, [markers])

  const loadMonth = useCallback(async () => {
    if (!active?.slug) return
    setError(null)
    try {
      const data = (await circleJournalApi.month(active.slug, ym)) as {
        markers?: Marker[]
        can_manage?: boolean
      }
      setMarkers(data.markers ?? [])
      if (data.can_manage != null) setCanManage(!!data.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Chargement impossible')
    }
  }, [active?.slug, ym])

  const loadSession = useCallback(async () => {
    if (!active?.slug || !selectedDay) return
    setLoading(true)
    setError(null)
    try {
      const data = (await circleJournalApi.session(active.slug, selectedDay, slot)) as {
        session?: Session | null
        can_manage?: boolean
      }
      const s = data.session ?? null
      setSession(s)
      setTitle(s?.title ?? '')
      setSummary(s?.summary ?? '')
      setImageData(s?.image_data ?? null)
      if (data.can_manage != null) setCanManage(!!data.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Chargement impossible')
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [active?.slug, selectedDay, slot])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const onPickImage = async (file: File | null) => {
    if (!file) return
    const { dataUrl, error: err } = await compressAvatarImage(file, 180_000)
    if (err || !dataUrl) {
      setError(err || 'Image invalide')
      return
    }
    setImageData(dataUrl)
  }

  const save = async () => {
    if (!active?.slug || !selectedDay) return
    if (!imageData && !session) {
      setError('Ajoutez une photo du tableau pour publier.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await circleJournalApi.upsert({
        community_slug: active.slug,
        day: selectedDay,
        slot,
        title: title.trim() || undefined,
        summary: summary.trim() || undefined,
        image_data: imageData || undefined,
      })
      await loadMonth()
      await loadSession()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!active?.slug || !selectedDay || !session) return
    if (!confirm('Supprimer ce créneau ?')) return
    try {
      await circleJournalApi.remove(active.slug, selectedDay, slot)
      setSession(null)
      setImageData(null)
      setTitle('')
      setSummary('')
      await loadMonth()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Suppression impossible')
    }
  }

  if (!active) {
    return (
      <div className="max-w-3xl mx-auto text-sm text-slate-400">
        Choisissez un lieu actif pour le journal des cercles.
      </div>
    )
  }

  const days = daysInMonth(ym)
  const pad = firstWeekdayMonday(ym)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Cercles</h1>
        <p className="text-sm text-slate-400 mt-1">
          Résumés matin / soir avec photo du tableau rempli pendant le cercle.
        </p>
        <p className="text-xs text-slate-500 mt-1">Lieu : {active.name}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setYm((v) => addMonths(v, -1))}
          className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm"
        >
          ←
        </button>
        <p className="font-semibold capitalize">{monthLabelFr(ym)}</p>
        <button
          type="button"
          onClick={() => setYm((v) => addMonths(v, 1))}
          className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-slate-500 mb-1">
        {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const marks = markerMap.get(day)
          const selected = selectedDay === day
          return (
            <button
              type="button"
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`aspect-square rounded-xl border text-sm flex flex-col items-center justify-center gap-0.5 ${
                selected
                  ? 'border-violet-500 bg-violet-950/40'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
              }`}
            >
              <span>{Number(day.slice(-2))}</span>
              <span className="flex gap-0.5">
                {marks?.morning && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                {marks?.evening && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-100">{selectedDay}</p>
            <div className="flex rounded-lg border border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setSlot('morning')}
                className={`px-3 py-1 text-sm rounded-md ${
                  slot === 'morning' ? 'bg-amber-600/30 text-amber-100' : 'text-slate-400'
                }`}
              >
                Matin
              </button>
              <button
                type="button"
                onClick={() => setSlot('evening')}
                className={`px-3 py-1 text-sm rounded-md ${
                  slot === 'evening' ? 'bg-sky-600/30 text-sky-100' : 'text-slate-400'
                }`}
              >
                Soir
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : canManage ? (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre (optionnel)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Résumé du cercle (optionnel)"
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <div>
                <label className="block text-xs text-slate-400 mb-1">Photo du tableau</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-400"
                />
                {imageData && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageData}
                    alt="Tableau du cercle"
                    className="mt-2 max-h-64 rounded-xl border border-slate-800 object-contain bg-slate-950"
                  />
                )}
              </div>
              {session?.created_by_pseudo && (
                <p className="text-xs text-slate-500">Publié par {session.created_by_pseudo}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  {session ? 'Mettre à jour' : 'Publier'}
                </button>
                {session && (
                  <button
                    type="button"
                    onClick={() => void remove()}
                    className="px-4 py-2 rounded-xl border border-rose-800/50 text-rose-300 text-sm"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {session ? (
                <>
                  {session.title && <p className="font-medium text-slate-100">{session.title}</p>}
                  {session.summary && (
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{session.summary}</p>
                  )}
                  {imageData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageData}
                      alt="Tableau du cercle"
                      className="max-h-64 rounded-xl border border-slate-800 object-contain bg-slate-950"
                    />
                  )}
                  {session.created_by_pseudo && (
                    <p className="text-xs text-slate-500">Publié par {session.created_by_pseudo}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  Pas encore de publication pour ce créneau.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-300 border border-rose-800/40 rounded-xl px-3 py-2 bg-rose-950/20">
          {error}
        </p>
      )}
    </div>
  )
}
