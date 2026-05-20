'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { eventsApi } from '@/api/events'
import { useCommunity } from '@/contexts/CommunityContext'
import { EventDetailPage } from '@/views/EventDetailPage'
import { EVENT_PHASES } from '@/lib/event-constants'
import { formatMandalaDate, parseMandalaDateTime } from '@/lib/format-datetime'
import { ApiError } from '@/lib/api-client'

type EventItem = {
  id: number
  title: string
  phase: string
  starts_at: string | null
  location: string | null
}

function phaseLabel(id: string) {
  return EVENT_PHASES.find((p) => p.id === id)?.label ?? id
}

function phaseBadgeClass(phase: string) {
  switch (phase) {
    case 'day':
      return 'bg-amber-950/60 text-amber-200 border-amber-700/40'
    case 'after':
      return 'bg-sky-950/60 text-sky-200 border-sky-700/40'
    case 'closed':
      return 'bg-slate-800/80 text-slate-400 border-slate-600/40'
    default:
      return 'bg-violet-950/60 text-violet-200 border-violet-700/40'
  }
}

function isUpcoming(ev: EventItem): boolean {
  const d = parseMandalaDateTime(ev.starts_at)
  if (!d) return true
  return d.getTime() >= Date.now()
}

function EventListSection({
  title,
  events,
  onSelect,
}: {
  title: string
  events: EventItem[]
  onSelect: (id: number) => void
}) {
  if (events.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{title}</h2>
      <ul className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => onSelect(ev.id)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex justify-between gap-4 text-left hover:border-violet-500/40 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-medium">{ev.title}</p>
                <span
                  className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${phaseBadgeClass(ev.phase)}`}
                >
                  {phaseLabel(ev.phase)}
                </span>
                {ev.location && <p className="text-xs text-slate-600">📍 {ev.location}</p>}
              </div>
              <span className="text-sm text-violet-300 whitespace-nowrap shrink-0 self-start">
                {formatMandalaDate(ev.starts_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CreateEventWizard({
  communitySlug,
  onClose,
  onCreated,
}: {
  communitySlug: string
  onClose: () => void
  onCreated: (eventId: number) => void
}) {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canNextStep1 = title.trim().length > 0

  const submit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = (await eventsApi.create({
        community_slug: communitySlug,
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        starts_at: startsAt ? startsAt.replace('T', ' ') : undefined,
        phase: 'preparation',
      })) as { event?: { id: number } }
      if (res.event?.id) onCreated(res.event.id)
      else onClose()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Création impossible')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-violet-800/40 bg-slate-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-violet-200">Nouvel événement</h2>
        <span className="text-xs text-slate-500">Étape {step} / 3</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-violet-500' : 'bg-slate-800'}`}
          />
        ))}
      </div>
      {step === 1 && (
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            Titre *
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'événement"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnel)"
              rows={3}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            Lieu
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Adresse ou lieu"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Date et heure de début
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-2 text-sm">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Récapitulatif</p>
          <dl className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div>
              <dt className="text-slate-500 text-xs">Titre</dt>
              <dd className="font-medium">{title.trim()}</dd>
            </div>
            {description.trim() && (
              <div>
                <dt className="text-slate-500 text-xs">Description</dt>
                <dd className="text-slate-300">{description.trim()}</dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500 text-xs">Lieu</dt>
              <dd>{location.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Début</dt>
              <dd>{startsAt ? startsAt.replace('T', ' ') : '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Phase initiale</dt>
              <dd>{phaseLabel('preparation')}</dd>
            </div>
          </dl>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          Annuler
        </button>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-700"
          >
            Précédent
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            disabled={step === 1 && !canNextStep1}
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 text-white disabled:opacity-50"
          >
            Suivant
          </button>
        )}
        {step === 3 && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Création…' : "Créer l'événement"}
          </button>
        )}
      </div>
    </div>
  )
}

export function EventsPage({
  openEventId,
  onOpenEvent,
}: {
  openEventId?: number | null
  onOpenEvent?: (id: number | null) => void
}) {
  const { active } = useCommunity()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(openEventId ?? null)
  const [showCreate, setShowCreate] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const setSelected = (id: number | null) => {
    setSelectedId(id)
    onOpenEvent?.(id)
  }

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setError(null)
    try {
      const res = (await eventsApi.list(active.slug)) as { events?: EventItem[]; can_manage?: boolean }
      setEvents(res.events ?? [])
      setCanManage(!!res.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (openEventId) setSelectedId(openEventId)
  }, [openEventId])

  const { upcoming, past } = useMemo(() => {
    const up: EventItem[] = []
    const pa: EventItem[] = []
    for (const ev of events) {
      if (isUpcoming(ev)) up.push(ev)
      else pa.push(ev)
    }
    const byDate = (a: EventItem, b: EventItem) => {
      const da = parseMandalaDateTime(a.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const db = parseMandalaDateTime(b.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return da - db
    }
    up.sort(byDate)
    pa.sort((a, b) => {
      const da = parseMandalaDateTime(a.starts_at)?.getTime() ?? 0
      const db = parseMandalaDateTime(b.starts_at)?.getTime() ?? 0
      return db - da
    })
    return { upcoming: up, past: pa }
  }, [events])

  if (selectedId && active?.slug) {
    return (
      <EventDetailPage
        eventId={selectedId}
        communitySlug={active.slug}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Événements — {active?.name}</h1>
          <p className="text-sm text-slate-400 mt-1">Phases, équipe et tâches par événement</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
          >
            Rafraîchir
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
            >
              {showCreate ? 'Fermer' : '+ Événement'}
            </button>
          )}
        </div>
      </div>
      {showCreate && canManage && active?.slug && (
        <CreateEventWizard
          communitySlug={active.slug}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            void load().then(() => setSelected(id))
          }}
        />
      )}
      {loading && <p className="text-slate-400 text-sm">Chargement…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="text-slate-500 text-sm italic">Aucun événement pour cette communauté.</p>
      )}
      {!loading && !error && events.length > 0 && (
        <div className="space-y-6">
          <EventListSection title="À venir" events={upcoming} onSelect={setSelected} />
          <EventListSection title="Passés" events={past} onSelect={setSelected} />
        </div>
      )}
    </div>
  )
}
