'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { calendarApi } from '@/api/calendar'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'
import { parseMandalaDateTime } from '@/lib/format-datetime'
import { enumerateEventDays, getEventSpanPosition } from '@/lib/event-dates'
import { ApiError } from '@/lib/api-client'
import { eventsApi } from '@/api/events'
import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid'
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView'
import { CalendarDayPanel, type DayDetailData } from '@/components/calendar/CalendarDayPanel'
import {
  type CalendarViewMode,
  type DayEvent,
  type MonthData,
  type MonthDay,
  addMonths,
  addWeeks,
  dateToDay,
  daysInSelection,
  mergeMonthData,
  monthLabelFr,
  selectionSpan,
  startOfWeekMonday,
  weekDaysFromMonday,
  weekLabelFr,
  weekdayHeadersFr,
  ymsForWeek,
  ymToday,
} from '@/components/calendar/calendar-utils'

export function CalendarPage() {
  const { active } = useCommunity()
  const { user } = useAuth()
  const viewerId = user?.id != null ? Number(user.id) : null
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [ym, setYm] = useState(ymToday())
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekMonday(dateToDay(new Date())))
  const [data, setData] = useState<MonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [anchorDay, setAnchorDay] = useState<string | null>(null)
  const [multiSelect, setMultiSelect] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [dayDetail, setDayDetail] = useState<DayDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [presenceBusy, setPresenceBusy] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const today = useMemo(() => new Date(), [])
  const weekDays = useMemo(() => weekDaysFromMonday(weekAnchor), [weekAnchor])

  const loadData = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setError(null)
    try {
      if (viewMode === 'month') {
        const res = (await calendarApi.month(active.slug, ym)) as MonthData
        setData(res)
      } else {
        const yms = ymsForWeek(weekAnchor)
        const results = await Promise.all(
          yms.map((m) => calendarApi.month(active.slug, m) as Promise<MonthData>)
        )
        setData(mergeMonthData(results))
      }
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [active?.slug, ym, viewMode, weekAnchor])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const daysMap = useMemo(() => {
    const map = new Map<string, MonthDay>()
    for (const d of data?.days ?? []) map.set(d.day, d)
    return map
  }, [data?.days])

  const grid = useMemo(() => {
    const days = data?.days ?? []
    const map = new Map(days.map((d) => [d.day, d]))
    const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
    const first = new Date(y, m - 1, 1)
    const last = new Date(y, m, 0)
    const start = new Date(first)
    const dow = (first.getDay() + 6) % 7
    start.setDate(first.getDate() - dow)
    const end = new Date(last)
    const dowEnd = (last.getDay() + 6) % 7
    end.setDate(last.getDate() + (6 - dowEnd))

    const out: Array<{ day: string; inMonth: boolean; info?: (typeof days)[number] }> = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = dateToDay(d)
      out.push({ day, inMonth: d.getMonth() === first.getMonth(), info: map.get(day) })
    }
    return out
  }, [data?.days, ym])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>()
    for (const ev of data?.events ?? []) {
      const days = enumerateEventDays(ev.starts_at, ev.ends_at)
      if (days.length === 0) continue
      const startDay = days[0]
      const endDay = days[days.length - 1]
      for (const day of days) {
        const list = map.get(day) ?? []
        list.push({ ...ev, spanPosition: getEventSpanPosition(day, startDay, endDay) })
        map.set(day, list)
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const da = parseMandalaDateTime(a.starts_at)?.getTime() ?? 0
        const db = parseMandalaDateTime(b.starts_at)?.getTime() ?? 0
        return da - db
      })
    }
    return map
  }, [data?.events])

  const openDay = useCallback(
    async (day: string) => {
      if (!active?.slug) return
      setSelectedDay(day)
      setDetailLoading(true)
      setActionMsg(null)
      try {
        const res = (await calendarApi.day(active.slug, day)) as DayDetailData
        setDayDetail(res)
      } catch (e: unknown) {
        setDayDetail(null)
        setActionMsg(e instanceof ApiError ? e.detail : 'Impossible de charger le détail du jour')
      } finally {
        setDetailLoading(false)
      }
    },
    [active?.slug]
  )

  useEffect(() => {
    if (!active?.slug) return
    let t: number | undefined
    const onEventsChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ communitySlug?: string }>).detail
      if (detail?.communitySlug !== active.slug) return
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => {
        void loadData()
        if (selectedDay) void openDay(selectedDay)
      }, 250)
    }
    window.addEventListener('mandala-events-changed', onEventsChanged)
    return () => {
      if (t) window.clearTimeout(t)
      window.removeEventListener('mandala-events-changed', onEventsChanged)
    }
  }, [active?.slug, loadData, openDay, selectedDay])

  const setPresence = useCallback(
    async (day: string, present: boolean, userId?: number) => {
      if (!active?.slug) return
      setActionMsg(null)
      setPresenceBusy(true)
      try {
        await calendarApi.setPresence({
          community_slug: active.slug,
          day,
          present,
          ...(userId != null ? { user_id: userId } : {}),
        })
        await loadData()
        if (selectedDay === day) await openDay(day)
      } catch (e: unknown) {
        setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
      } finally {
        setPresenceBusy(false)
      }
    },
    [active?.slug, loadData, openDay, selectedDay]
  )

  const updateSettings = useCallback(
    async (patch: { show_presence?: boolean; show_events?: boolean; open_weekdays?: number[] }) => {
      if (!active?.slug) return
      setActionMsg(null)
      try {
        await calendarApi.updateSettings({ community_slug: active.slug, ...patch })
        await loadData()
        if (selectedDay) await openDay(selectedDay)
      } catch (e: unknown) {
        setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
      }
    },
    [active?.slug, loadData, openDay, selectedDay]
  )

  const canManage = !!data?.can_manage
  const showPresence = data?.settings?.show_presence ?? true
  const showEvents = data?.settings?.show_events ?? true
  const openWeekdays = data?.settings?.open_weekdays ?? []
  const selectedDayInfo = selectedDay ? daysMap.get(selectedDay) : undefined
  const todayStr = dateToDay(today)
  const upcomingOpen = (data?.days ?? []).filter((d) => d.day >= todayStr && !d.is_disabled).slice(0, 8)
  const periodReachesToday = (data?.days ?? []).some((d) => d.day >= todayStr)

  const orderedDays = viewMode === 'month' ? grid.filter((c) => c.inMonth).map((c) => c.day) : weekDays

  const handleSelectDay = (day: string, shift: boolean) => {
    if (canManage && shift && anchorDay) {
      setSelectedDays(daysInSelection(anchorDay, day, orderedDays))
      void openDay(day)
      return
    }
    if (canManage && multiSelect) {
      const next = selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort()
      setAnchorDay(day)
      setSelectedDays(next)
      if (next.length === 0) {
        setSelectedDay(null)
        setDayDetail(null)
        return
      }
      void openDay(next.includes(day) ? day : next[next.length - 1])
      return
    }
    setAnchorDay(day)
    setSelectedDays([day])
    void openDay(day)
  }

  const refreshAfterBulk = async () => {
    await loadData()
    if (selectedDay && selectedDays.includes(selectedDay)) await openDay(selectedDay)
  }

  const applyToSelection = async (patch: {
    is_disabled?: boolean
    reason?: string
    max_participants?: number
  }) => {
    if (!active?.slug || selectedDays.length === 0) return
    setActionMsg(null)
    setBulkBusy(true)
    try {
      await calendarApi.setDays({ community_slug: active.slug, days: selectedDays, ...patch })
      await refreshAfterBulk()
    } catch (e: unknown) {
      setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
    } finally {
      setBulkBusy(false)
    }
  }

  const createEventFromSelection = async (title: string, openDays: boolean) => {
    if (!active?.slug) return
    const span = selectionSpan(selectedDays)
    if (!span) return
    setActionMsg(null)
    setBulkBusy(true)
    try {
      await eventsApi.create({
        community_slug: active.slug,
        title,
        starts_at: `${span.start} 10:00:00`,
        ends_at: `${span.end} 18:00:00`,
        phase: 'preparation',
      })
      if (openDays) {
        await calendarApi.setDays({
          community_slug: active.slug,
          days: selectedDays,
          is_disabled: false,
        })
      }
      window.dispatchEvent(
        new CustomEvent('mandala-events-changed', { detail: { communitySlug: active.slug } })
      )
      await refreshAfterBulk()
      setActionMsg('Événement créé.')
    } catch (e: unknown) {
      setActionMsg(e instanceof ApiError ? e.detail : 'Création impossible')
    } finally {
      setBulkBusy(false)
    }
  }

  const setEventSpanPresence = async (days: string[], present: boolean) => {
    if (!active?.slug || days.length === 0) return
    setActionMsg(null)
    setPresenceBusy(true)
    try {
      if (days.length === 1) {
        await calendarApi.setPresence({ community_slug: active.slug, day: days[0], present })
        setActionMsg(present ? 'Inscription enregistrée.' : 'Inscription retirée.')
      } else {
        const res = (await calendarApi.setPresenceDays({
          community_slug: active.slug,
          days,
          present,
        })) as { applied?: string[]; skipped?: Array<{ day: string; reason: string }> }
        const applied = res.applied?.length ?? 0
        const skipped = res.skipped?.length ?? 0
        if (present) {
          const bits = [`Inscrit sur ${applied} jour${applied > 1 ? 's' : ''}.`]
          if (skipped > 0) bits.push(`${skipped} jour${skipped > 1 ? 's' : ''} fermé${skipped > 1 ? 's' : ''} ou complet${skipped > 1 ? 's' : ''}.`)
          setActionMsg(bits.join(' '))
        } else {
          setActionMsg('Inscription retirée sur ces jours.')
        }
      }
      await loadData()
      if (selectedDay) await openDay(selectedDay)
    } catch (e: unknown) {
      setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
    } finally {
      setPresenceBusy(false)
    }
  }

  const goToday = () => {
    const t = dateToDay(today)
    setYm(ymToday())
    setWeekAnchor(startOfWeekMonday(t))
    setAnchorDay(t)
    setSelectedDays([t])
    void openDay(t)
  }

  const switchView = (mode: CalendarViewMode) => {
    if (mode === viewMode) return
    const ref = selectedDay ?? dateToDay(today)
    setViewMode(mode)
    if (mode === 'week') {
      setWeekAnchor(startOfWeekMonday(ref))
    } else {
      setYm(ref.slice(0, 7))
    }
  }

  const clearSelection = () => {
    setSelectedDays([])
    setSelectedDay(null)
    setDayDetail(null)
  }

  const panelProps = selectedDay
    ? {
        selectedDay,
        dayDetail,
        selectedDayInfo,
        detailLoading,
        showEvents,
        showPresence,
        canManage,
        viewerId,
        presenceBusy,
        selectedDays,
        selectionBusy: bulkBusy,
        onToggleSelfPresence: (present: boolean) => void setPresence(selectedDay, present),
        onApplySelection: (patch: {
          is_disabled?: boolean
          reason?: string
          max_participants?: number
        }) => void applyToSelection(patch),
        onCreateSelectionEvent: (title: string, openDays: boolean) =>
          void createEventFromSelection(title, openDays),
        onClearSelection: clearSelection,
        onRemoveUser: (userId: number) => void setPresence(selectedDay, false, userId),
        onSetEventSpanPresence: (days: string[], present: boolean) => void setEventSpanPresence(days, present),
        dayOpen: (day: string) => (daysMap.has(day) ? !daysMap.get(day)!.is_disabled : null),
        dayPresent: (day: string) => (daysMap.has(day) ? !!daysMap.get(day)!.i_am_present : null),
      }
    : null

  return (
    <div className="w-full space-y-4 pb-2">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Agenda</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {viewMode === 'month' ? 'Vue mensuelle' : 'Vue hebdomadaire détaillée'}
              {canManage ? ' · gestion activée' : ''}
            </p>
          </div>

          <div className="flex flex-wrap rounded-xl border border-slate-800 bg-slate-900/60 p-1 self-start gap-1">
            <button
              type="button"
              onClick={() => switchView('month')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mois
            </button>
            <button
              type="button"
              onClick={() => switchView('week')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semaine
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setMultiSelect((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  multiSelect ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Plusieurs jours
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'month') setYm((v) => addMonths(v, -1))
              else setWeekAnchor((w) => addWeeks(w, -1))
            }}
            className="min-w-[40px] h-10 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300"
            aria-label={viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'}
          >
            ‹
          </button>
          <div className="flex-1 min-w-0 px-3 h-10 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-sm font-medium capitalize text-slate-200 text-center">
            {viewMode === 'month' ? monthLabelFr(ym) : weekLabelFr(weekAnchor)}
          </div>
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'month') setYm((v) => addMonths(v, 1))
              else setWeekAnchor((w) => addWeeks(w, 1))
            }}
            className="min-w-[40px] h-10 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300"
            aria-label={viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'}
          >
            ›
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-10 px-3 rounded-xl border border-violet-600/40 bg-violet-600/15 text-violet-200 text-sm font-medium hover:bg-violet-600/25 shrink-0"
          >
            Auj.
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-600" /> Jour ouvert
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-600" /> Complet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-600" /> Jour fermé
        </span>
        {showEvents && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500" /> Événement
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Jour J
            </span>
          </>
        )}
        {showPresence && (
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-400">●</span> Vous êtes inscrit
          </span>
        )}
      </div>

      {canManage && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setAdminOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30"
          >
            <span className="text-sm font-medium text-slate-300">Réglages du calendrier</span>
            <span className="text-slate-500 text-sm">{adminOpen ? '▴' : '▾'}</span>
          </button>
          {adminOpen && (
            <div className="px-4 pb-4 flex flex-wrap gap-4 border-t border-slate-800 pt-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={showPresence}
                  onChange={(e) => void updateSettings({ show_presence: e.target.checked })}
                  className="rounded"
                />
                Présences
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={showEvents}
                  onChange={(e) => void updateSettings({ show_events: e.target.checked })}
                  className="rounded"
                />
                Événements
              </label>
              <div className="w-full">
                <p className="text-xs text-slate-400 mb-2">Ouverts chaque semaine</p>
                <div className="flex flex-wrap gap-1.5">
                  {weekdayHeadersFr(false).map((label, index) => {
                    const on = openWeekdays.includes(index)
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? openWeekdays.filter((d) => d !== index)
                            : [...openWeekdays, index].sort((a, b) => a - b)
                          void updateSettings({ open_weekdays: next })
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          on
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Sans ces jours, le calendrier reste fermé tant qu&apos;un jour n&apos;est pas ouvert.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-500 text-sm">
          Chargement…
        </div>
      )}
      {error && <p className="text-red-400 text-sm px-1">{error}</p>}
      {actionMsg && <p className="text-amber-300 text-sm px-1">{actionMsg}</p>}

      {!loading && !error && (
        <div
          className={
            panelProps
              ? 'lg:grid lg:grid-cols-[1fr_minmax(300px,340px)] lg:gap-5 lg:items-start'
              : ''
          }
        >
          <div className="space-y-3">
            {periodReachesToday && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                  Prochains jours ouverts
                </p>
                {upcomingOpen.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun jour ouvert pour l&apos;instant.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {upcomingOpen.map((d) => {
                      const when = new Date(`${d.day}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                      const full = d.present_count >= d.max_participants
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => handleSelectDay(d.day, false)}
                          className={`px-2.5 py-1 rounded-lg text-xs border ${
                            full
                              ? 'border-amber-600/50 text-amber-100 bg-amber-950/30'
                              : 'border-emerald-600/40 text-emerald-100 bg-emerald-950/30'
                          }`}
                        >
                          {when}
                          {full ? ' · complet' : ''}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'month' ? (
              <CalendarMonthGrid
                grid={grid}
                events={data?.events ?? []}
                selectedDays={selectedDays}
                today={today}
                showEvents={showEvents}
                showPresence={showPresence}
                viewerId={viewerId}
                onSelectDay={handleSelectDay}
              />
            ) : (
              <CalendarWeekView
                weekDays={weekDays}
                daysMap={daysMap}
                eventsByDay={eventsByDay}
                selectedDays={selectedDays}
                today={today}
                showEvents={showEvents}
                showPresence={showPresence}
                viewerId={viewerId}
                onSelectDay={handleSelectDay}
              />
            )}

            <p className="text-center text-xs text-slate-500 pb-1">
              {canManage
                ? 'Un jour ou plusieurs : ouvrir et fermer se font dans le bloc de détail.'
                : 'Touchez un jour pour le détail.'}
            </p>

            {panelProps && (
              <div className="lg:hidden">
                <CalendarDayPanel {...panelProps} variant="sidebar" />
              </div>
            )}
          </div>

          {panelProps && (
            <div className="hidden lg:block sticky top-[68px]">
              <CalendarDayPanel {...panelProps} variant="sidebar" />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
