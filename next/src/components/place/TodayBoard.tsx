'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'
import { placeListsApi } from '@/api/place-ops'
import { calendarApi } from '@/api/calendar'
import { FeedSection } from '@/components/community/FeedSection'
import { ApiError } from '@/lib/api-client'
import { dayLabelFr } from '@/components/calendar/calendar-utils'

type TodayPayload = {
  day: string
  can_manage?: boolean
  presence: {
    is_disabled: boolean
    max_participants: number
    present_count: number
    i_am_present: boolean
    present_users: Array<{ user_id: number; pseudo: string }>
    show_presence: boolean
  }
  events: Array<{
    id: number
    title: string
    starts_at: string | null
    location: string | null
    phase: string
  }>
  courses: Array<{
    id: number
    title: string
    claimed_by_pseudo: string | null
    bring_date: string | null
    claims?: Array<{ pseudo: string }>
    photo_count: number
    for_today?: boolean
  }>
  logistics: Array<{
    id: number
    title: string
    claimed_by_pseudo: string | null
    bring_date: string | null
    claims?: Array<{ pseudo: string }>
    photo_count: number
    for_today?: boolean
  }>
  courses_open_count?: number
  logistics_open_count?: number
  courses_today_count?: number
  logistics_today_count?: number
  circles: {
    morning: { title: string | null; summary: string | null; has_image: boolean } | null
    evening: { title: string | null; summary: string | null; has_image: boolean } | null
  }
}

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(startsAt: string | null): string {
  if (!startsAt) return ''
  try {
    const d = new Date(startsAt.includes('T') ? startsAt : startsAt.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function TodayBoard({
  onNavigate,
  onOpenEvent,
}: {
  onNavigate: MandalaNavigate
  onOpenEvent?: (eventId: number) => void
}) {
  const { active } = useCommunity()
  const [data, setData] = useState<TodayPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presenceBusy, setPresenceBusy] = useState(false)

  const day = todayYmd()
  const accent = active?.accent_color ?? '#7c3aed'

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setError(null)
    try {
      const res = (await placeListsApi.today(active.slug, day)) as TodayPayload
      setData(res)
    } catch (e: unknown) {
      setData(null)
      setError(e instanceof ApiError ? e.detail : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [active?.slug, day])

  useEffect(() => {
    void load()
  }, [load])

  const togglePresence = async () => {
    if (!active?.slug || !data || data.presence.is_disabled) return
    setPresenceBusy(true)
    try {
      await calendarApi.setPresence({
        community_slug: active.slug,
        day,
        present: !data.presence.i_am_present,
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Inscription impossible')
    } finally {
      setPresenceBusy(false)
    }
  }

  if (!active) return null

  const label = dayLabelFr(day)

  return (
    <FeedSection
      icon="☀️"
      title="Vie du lieu"
      subtitle={label.charAt(0).toUpperCase() + label.slice(1)}
      tone="custom"
      accentColor={accent}
      collapsible
      storageKey="mdl_place_life_board_collapsed"
      action={
        <button
          type="button"
          onClick={() => onNavigate('calendar')}
          className="text-sm font-medium hover:underline"
          style={{ color: accent }}
        >
          Agenda →
        </button>
      }
    >
      {loading && <p className="text-sm text-slate-500">Chargement…</p>}
      {error && !loading && (
        <p className="text-sm text-amber-200/90">{error}</p>
      )}

      {!loading && data && (
        <div className="space-y-4">
          {/* Présence */}
          {data.presence.show_presence && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">Présents</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.presence.is_disabled
                    ? 'Journée fermée'
                    : `${data.presence.present_count} / ${data.presence.max_participants}`}
                  {data.presence.present_users.length > 0 && (
                    <span className="text-slate-500">
                      {' '}
                      ·{' '}
                      {data.presence.present_users
                        .slice(0, 4)
                        .map((u) => u.pseudo)
                        .join(', ')}
                      {data.presence.present_count > 4 ? '…' : ''}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={data.presence.is_disabled || presenceBusy}
                onClick={() => void togglePresence()}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 ${
                  data.presence.i_am_present
                    ? 'border border-emerald-500/40 text-emerald-200 bg-emerald-950/30'
                    : 'bg-violet-600 text-white'
                }`}
              >
                {data.presence.i_am_present ? 'Annuler' : 'Je viens'}
              </button>
            </div>
          )}

          {/* Événements */}
          <BoardBlock
            title="Événements"
            empty="Rien de prévu aujourd’hui"
            onMore={() => onNavigate('events')}
            moreLabel="Tous"
          >
            {data.events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => (onOpenEvent ? onOpenEvent(ev.id) : onNavigate('events', { eventId: ev.id }))}
                className="w-full text-left text-sm text-slate-200 hover:text-white truncate"
              >
                {formatTime(ev.starts_at) && (
                  <span className="text-slate-500 tabular-nums mr-2">{formatTime(ev.starts_at)}</span>
                )}
                {ev.title}
              </button>
            ))}
          </BoardBlock>

          {/* Courses — résumé des besoins en cours */}
          <BoardBlock
            title={`Courses${(data.courses_open_count ?? 0) > 0 ? ` (${data.courses_open_count})` : ''}`}
            empty="Liste vide pour le moment"
            onMore={() => onNavigate('courses')}
            moreLabel="Liste"
          >
            {data.courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onNavigate('courses')}
                className="w-full text-left text-sm text-slate-200 hover:text-white truncate"
              >
                {c.for_today && (
                  <span className="text-[10px] uppercase text-emerald-400/90 mr-1.5">Aujourd’hui</span>
                )}
                {c.title}
                <span className="text-slate-500 text-xs ml-1">
                  {c.claims?.length
                    ? c.claims.map((x) => x.pseudo).join(', ')
                    : c.claimed_by_pseudo || 'libre'}
                  {c.bring_date && !c.for_today ? ` · ${c.bring_date}` : ''}
                </span>
              </button>
            ))}
          </BoardBlock>

          {/* Logistique — résumé des besoins en cours */}
          <BoardBlock
            title={`Logistique${(data.logistics_open_count ?? 0) > 0 ? ` (${data.logistics_open_count})` : ''}`}
            empty="Aucun besoin en cours"
            onMore={() => onNavigate('logistics')}
            moreLabel="Liste"
          >
            {data.logistics.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onNavigate('logistics')}
                className="w-full text-left text-sm text-slate-200 hover:text-white truncate"
              >
                {c.for_today && (
                  <span className="text-[10px] uppercase text-emerald-400/90 mr-1.5">Aujourd’hui</span>
                )}
                {c.title}
                <span className="text-slate-500 text-xs ml-1">
                  {c.claims?.length
                    ? `${c.claims.length} engagé(s)`
                    : c.claimed_by_pseudo || 'libre'}
                  {c.photo_count > 0 ? ` · ${c.photo_count} photo${c.photo_count > 1 ? 's' : ''}` : ''}
                  {c.bring_date && !c.for_today ? ` · ${c.bring_date}` : ''}
                </span>
              </button>
            ))}
          </BoardBlock>

          {/* Cercles */}
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">Cercles</p>
              <button
                type="button"
                onClick={() => onNavigate('circles')}
                className="text-xs font-medium hover:underline"
                style={{ color: accent }}
              >
                Journal →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CircleChip
                label="Matin"
                session={data.circles.morning}
                tone="amber"
              />
              <CircleChip
                label="Soir"
                session={data.circles.evening}
                tone="sky"
              />
            </div>
          </div>
        </div>
      )}
    </FeedSection>
  )
}

function BoardBlock({
  title,
  empty,
  onMore,
  moreLabel,
  children,
}: {
  title: string
  empty: string
  onMore: () => void
  moreLabel: string
  children: ReactNode
}) {
  const childArr = Array.isArray(children) ? children : children ? [children] : []
  const count = childArr.filter((c) => c != null && c !== false).length

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <button type="button" onClick={onMore} className="text-xs text-slate-400 hover:text-slate-200">
          {moreLabel} →
        </button>
      </div>
      {count === 0 ? (
        <p className="text-xs text-slate-500 italic">{empty}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  )
}

function CircleChip({
  label,
  session,
  tone,
}: {
  label: string
  session: { title: string | null; summary: string | null; has_image: boolean } | null
  tone: 'amber' | 'sky'
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-700/40 bg-amber-950/20'
      : 'border-sky-700/40 bg-sky-950/20'
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      {session ? (
        <>
          <p className="text-xs text-slate-200 mt-0.5 truncate">
            {session.title || (session.has_image ? 'Photo publiée' : 'Publié')}
          </p>
          {session.has_image && (
            <p className="text-[10px] text-slate-500 mt-0.5">Tableau ✓</p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-500 mt-0.5 italic">Pas encore</p>
      )}
    </div>
  )
}
