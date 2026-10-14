'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  returnsApi,
  type DesignateSlot,
  type ReturnDraft,
  type ReturnItem,
  type ReturnsPage,
  type ReturnSummary,
  type WriteSlot,
} from '@/api/returns'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api-client'

const EMPTY_DRAFT: ReturnDraft = { clarity: 0, frame: 0, quality: 0, recommend: true, body: '' }

function qualityLabel(kind: 'place' | 'event' | 'accompaniment'): string {
  if (kind === 'event') return 'Qualité de l’événement'
  if (kind === 'accompaniment') return 'Qualité de ce moment'
  return 'Qualité du séjour'
}

function promptFor(kind: 'place' | 'event' | 'accompaniment'): string {
  if (kind === 'event') return 'Comment s’est passé cet événement ?'
  if (kind === 'accompaniment') return 'Comment s’est passé ce moment ?'
  return 'Comment s’est passé ce séjour ?'
}

function SummaryBlock({ summary, quality }: { summary: ReturnSummary; quality: string }) {
  return (
    <div className="space-y-1 text-sm text-slate-300">
      <p>
        {summary.count} retour{summary.count > 1 ? 's' : ''}
        {summary.show_average && summary.clarity != null && (
          <>
            {' '}
            · clarté {summary.clarity.toFixed(1)} · cadre {summary.frame?.toFixed(1)} ·{' '}
            {quality.toLowerCase()} {summary.quality?.toFixed(1)} · je recommande {summary.recommend_yes}/
            {summary.count}
          </>
        )}
      </p>
      {!summary.show_average && summary.count > 0 && (
        <p className="text-xs text-slate-500">La moyenne s’affiche à partir de trois retours.</p>
      )}
      {summary.removed_count > 0 && (
        <p className="text-xs text-slate-500">
          {summary.removed_count} retour{summary.removed_count > 1 ? 's retirés' : ' retiré'}
        </p>
      )}
    </div>
  )
}

function ScorePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs text-slate-400">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-lg text-sm border ${
              value === n
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ReturnForm({
  kind,
  occasion,
  initial,
  submitLabel,
  onSubmit,
}: {
  kind: 'place' | 'event' | 'accompaniment'
  occasion: string
  initial?: ReturnDraft
  submitLabel: string
  onSubmit: (draft: ReturnDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<ReturnDraft>(initial ?? EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await onSubmit(draft)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <p className="text-sm text-slate-200">{promptFor(kind)}</p>
      <p className="text-xs text-slate-500">
        {occasion}. Présence déclarée au calendrier. Un retour par occasion.
      </p>
      <ScorePicker label="Clarté" value={draft.clarity} onChange={(n) => setDraft((d) => ({ ...d, clarity: n }))} />
      <ScorePicker label="Cadre" value={draft.frame} onChange={(n) => setDraft((d) => ({ ...d, frame: n }))} />
      <ScorePicker
        label={qualityLabel(kind)}
        value={draft.quality}
        onChange={(n) => setDraft((d) => ({ ...d, quality: n }))}
      />
      <fieldset className="space-y-1">
        <legend className="text-xs text-slate-400">Je le recommande</legend>
        <div className="flex gap-2">
          {[
            { value: true, label: 'Oui' },
            { value: false, label: 'Non' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={draft.recommend === option.value}
              onClick={() => setDraft((d) => ({ ...d, recommend: option.value }))}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                draft.recommend === option.value
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs text-slate-400">
        Texte
        <textarea
          value={draft.body}
          maxLength={1000}
          rows={4}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
      </label>
      {kind === 'accompaniment' && (
        <p className="text-xs text-slate-500">
          Votre retour sera visible quand l’autre personne aura aussi écrit, ou dans 14 jours.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || draft.clarity < 1 || draft.frame < 1 || draft.quality < 1}
        className="text-sm px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {busy ? 'Envoi…' : submitLabel}
      </button>
    </form>
  )
}

function ReturnCard({ item, onChanged }: { item: ReturnItem; onChanged: () => void }) {
  const [reply, setReply] = useState('')
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const kind = item.target_type === 'event' ? 'event' : item.target_type === 'accompaniment' ? 'accompaniment' : 'place'

  async function sendReply() {
    setError(null)
    try {
      await returnsApi.reply(item.id, reply)
      setReply('')
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Réponse impossible')
    }
  }

  async function sendReport() {
    setError(null)
    try {
      await returnsApi.report(item.id, reason)
      setReason('')
      setReporting(false)
      setInfo('Signalement envoyé.')
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Signalement impossible')
    }
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 space-y-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-200">{item.author_name}</p>
        <p className="text-xs text-slate-500">{item.occasion_label}</p>
      </header>
      {item.pending_note && <p className="text-xs text-amber-200/80">{item.pending_note}</p>}
      <p className="text-xs text-slate-400">
        Clarté {item.clarity} · Cadre {item.frame} · {qualityLabel(kind)} {item.quality} ·{' '}
        {item.recommend ? 'Recommande' : 'Ne recommande pas'}
      </p>
      {item.body && <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">{item.body}</p>}
      {item.reply_body && (
        <div className="border-t border-slate-800 pt-2">
          <p className="text-xs text-slate-500">Réponse de {item.reply_name}</p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.reply_body}</p>
        </div>
      )}
      {editing && (
        <ReturnForm
          kind={kind}
          occasion={item.occasion_label}
          initial={{
            clarity: item.clarity,
            frame: item.frame,
            quality: item.quality,
            recommend: item.recommend,
            body: item.body,
          }}
          submitLabel="Enregistrer"
          onSubmit={async (draft) => {
            await returnsApi.update(item.id, draft)
            setEditing(false)
            onChanged()
          }}
        />
      )}
      {item.can_edit && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-violet-300 hover:underline">
          Modifier (48 h)
        </button>
      )}
      {item.can_reply && (
        <div className="space-y-2 pt-1">
          <textarea
            value={reply}
            rows={3}
            maxLength={1000}
            placeholder="Une réponse, une seule fois"
            onChange={(e) => setReply(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => void sendReply()} className="text-xs px-3 py-1.5 rounded-lg border border-slate-600">
            Publier la réponse
          </button>
        </div>
      )}
      {!item.is_mine && item.status === 'published' && (
        <button type="button" onClick={() => setReporting((v) => !v)} className="text-xs text-slate-500 hover:text-slate-300">
          Signaler
        </button>
      )}
      {reporting && (
        <div className="space-y-2">
          <textarea
            value={reason}
            rows={2}
            maxLength={500}
            placeholder="Motif du signalement"
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => void sendReport()} className="text-xs px-3 py-1.5 rounded-lg border border-slate-600">
            Envoyer le signalement
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}
    </article>
  )
}

function DesignatePanel({ userId }: { userId: number }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<DesignateSlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await returnsApi.candidates(userId)
      setSlots(res.slots)
    } catch (err: unknown) {
      setSlots([])
      setError(err instanceof ApiError ? err.detail : 'Impossible de chercher une occasion')
    }
  }, [userId])

  useEffect(() => {
    if (open && slots == null) void load()
  }, [open, slots, load])

  if (!user) return null

  async function send(slot: DesignateSlot) {
    const key = `${slot.community_slug}:${slot.occasion_date}`
    setBusy(key)
    setError(null)
    try {
      await returnsApi.designate({
        community_slug: slot.community_slug,
        companion_user_id: userId,
        occasion_date: slot.occasion_date,
        event_id: slot.event_id,
      })
      setInfo('Demande envoyée. Le retour s’ouvre si la personne accepte.')
      setSlots((current) => current?.filter((s) => `${s.community_slug}:${s.occasion_date}` !== key) ?? [])
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Demande impossible')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm text-violet-300 hover:underline">
        J’ai passé un moment avec cette personne
      </button>
      {open && slots == null && <p className="text-xs text-slate-500">Recherche des présences communes…</p>}
      {open && slots && slots.length === 0 && (
        <p className="text-xs text-slate-500">
          Aucune présence passée en commun, ou cette personne n’a pas ouvert les retours.
        </p>
      )}
      {open && slots && slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((slot) => {
            const key = `${slot.community_slug}:${slot.occasion_date}`
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-300">
                  {slot.occasion_label}
                  <span className="text-slate-500"> · {slot.community_name}</span>
                </span>
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => void send(slot)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40"
                >
                  Désigner
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}
    </div>
  )
}

function AlertForm({ communitySlug, aboutUserId }: { communitySlug?: string; aboutUserId?: number }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [slug, setSlug] = useState(communitySlug ?? '')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (!communitySlug) return null

  async function send() {
    setError(null)
    try {
      await returnsApi.alert({
        community_slug: slug,
        about_user_id: aboutUserId,
        message,
      })
      setMessage('')
      setOpen(false)
      setInfo('Message transmis aux administrateurs. Il n’est pas publié.')
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Envoi impossible')
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-slate-500 hover:text-slate-300">
        Un problème de cadre, hors évaluation publique
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Ceci reste lisible seulement par les administrateurs de l’application. Ce n’est pas un retour.
          </p>
          {!communitySlug && (
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Identifiant du lieu"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          )}
          <textarea
            value={message}
            rows={3}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => void send()} className="text-xs px-3 py-1.5 rounded-lg border border-slate-600">
            Envoyer
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}
    </div>
  )
}

export function ReturnsBlock({
  mode,
  communitySlug,
  eventId,
  userId,
  heading = 'Retours',
  compact = false,
  allowDesignate = false,
}: {
  mode: 'place' | 'event' | 'person'
  communitySlug?: string
  eventId?: number
  userId?: number
  heading?: string
  compact?: boolean
  allowDesignate?: boolean
}) {
  const [page, setPage] = useState<ReturnsPage | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slotKey, setSlotKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data =
        mode === 'place' && communitySlug
          ? await returnsApi.place(communitySlug)
          : mode === 'event' && eventId
            ? await returnsApi.event(eventId)
            : mode === 'person' && userId
              ? await returnsApi.person(userId)
              : null
      setPage(data)
    } catch (err: unknown) {
      setPage(null)
      if (!(err instanceof ApiError && (err.status === 401 || err.status === 404))) {
        setError(err instanceof ApiError ? err.detail : 'Impossible de charger les retours')
      }
    } finally {
      setLoaded(true)
    }
  }, [mode, communitySlug, eventId, userId])

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) {
    return <p className="text-xs text-slate-500">Chargement des retours…</p>
  }
  if (!page) return error ? <p className="text-sm text-red-400">{error}</p> : null

  const kind = mode === 'person' ? 'accompaniment' : mode
  const quality = qualityLabel(kind)

  async function publish(slot: WriteSlot, draft: ReturnDraft) {
    await returnsApi.create(draft, {
      target: slot.kind,
      community_slug: slot.community_slug,
      event_id: slot.event_id || undefined,
      occasion_date: slot.occasion_date,
      accompaniment_id: slot.accompaniment_id || undefined,
    })
    setSlotKey(null)
    await load()
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        {compact ? (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</h3>
        ) : (
          <h2 className="text-xl font-semibold">{heading}</h2>
        )}
        <p className="text-sm text-slate-500">
          Écrits par des personnes présentes, une fois la date passée. La présence est celle déclarée au calendrier.
        </p>
        <SummaryBlock summary={page.summary} quality={quality} />
      </div>
      {page.items.length === 0 && <p className="text-sm text-slate-500">Pas encore de retour.</p>}
      <div className="space-y-3">
        {page.items.map((item) => (
          <ReturnCard key={item.id} item={item} onChanged={() => void load()} />
        ))}
      </div>
      {page.event_items.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-slate-200">Retours sur les événements</h3>
          {page.event_items.map((item) => (
            <ReturnCard key={item.id} item={item} onChanged={() => void load()} />
          ))}
        </div>
      )}
      {page.blocked_reason && <p className="text-sm text-slate-400">{page.blocked_reason}</p>}
      {page.write_slots.map((slot) => {
        const key = `${slot.kind}:${slot.event_id}:${slot.accompaniment_id}:${slot.occasion_date}`
        return (
          <div key={key}>
            {slotKey !== key ? (
              <button type="button" onClick={() => setSlotKey(key)} className="text-sm text-violet-300 hover:underline">
                Écrire un retour · {slot.occasion_label}
              </button>
            ) : (
              <ReturnForm
                kind={slot.kind}
                occasion={slot.occasion_label}
                submitLabel="Publier le retour"
                onSubmit={(draft) => publish(slot, draft)}
              />
            )}
          </div>
        )
      })}
      {allowDesignate && userId && <DesignatePanel userId={userId} />}
      {page.can_alert && communitySlug && (
        <AlertForm communitySlug={communitySlug} aboutUserId={mode === 'person' ? userId : undefined} />
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  )
}

export function WriteSlotForm({ slot, onDone }: { slot: WriteSlot; onDone: () => void }) {
  return (
    <ReturnForm
      kind={slot.kind}
      occasion={`${slot.occasion_label}${slot.other_name ? ` · ${slot.other_name}` : ''} · ${slot.community_name}`}
      submitLabel="Publier le retour"
      onSubmit={async (draft) => {
        await returnsApi.create(draft, {
          target: slot.kind,
          community_slug: slot.community_slug,
          event_id: slot.event_id || undefined,
          occasion_date: slot.occasion_date,
          accompaniment_id: slot.accompaniment_id || undefined,
        })
        onDone()
      }}
    />
  )
}
