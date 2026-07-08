'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { calendarApi } from '@/api/calendar'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'
import { parseMandalaDateTime } from '@/lib/format-datetime'
import { enumerateEventDays, getEventSpanPosition } from '@/lib/event-dates'
import { ApiError } from '@/lib/api-client'
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
  mergeMonthData,
  monthLabelFr,
  startOfWeekMonday,
  weekDaysFromMonday,
  weekLabelFr,
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
  const [dayDetail, setDayDetail] = useState<DayDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [presenceBusy, setPresenceBusy] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

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
    async (day: string, opts?: { sheet?: boolean }) => {
      if (!active?.slug) return
      setSelectedDay(day)
      if (opts?.sheet !== false && typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileSheetOpen(true)
      }
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
        if (selectedDay) void openDay(selectedDay, { sheet: false })
      }, 250)
    }
    window.addEventListener('mandala-events-changed', onEventsChanged)
    return () => {
      if (t) window.clearTimeout(t)
      window.removeEventListener('mandala-events-changed', onEventsChanged)
    }
  }, [active?.slug, loadData, openDay, selectedDay])

  useEffect(() => {
    if (loading || !data || selectedDay) return
    const todayStr = dateToDay(today)
    void openDay(todayStr, { sheet: false })
  }, [loading, data, selectedDay, today, openDay])

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
        if (selectedDay === day) await openDay(day, { sheet: false })
      } catch (e: unknown) {
        setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
      } finally {
        setPresenceBusy(false)
      }
    },
    [active?.slug, loadData, openDay, selectedDay]
  )

  const setDayDisabled = useCallback(
    async (day: string, is_disabled: boolean) => {
      if (!active?.slug) return
      setActionMsg(null)
      try {
        await calendarApi.setDayDisabled({ community_slug: active.slug, day, is_disabled })
        await loadData()
        if (selectedDay === day) await openDay(day, { sheet: false })
      } catch (e: unknown) {
        setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
      }
    },
    [active?.slug, loadData, openDay, selectedDay]
  )

  const updateSettings = useCallback(
    async (patch: { show_presence?: boolean; show_events?: boolean }) => {
      if (!active?.slug) return
      setActionMsg(null)
      try {
        await calendarApi.updateSettings({ community_slug: active.slug, ...patch })
        await loadData()
        if (selectedDay) await openDay(selectedDay, { sheet: false })
      } catch (e: unknown) {
        setActionMsg(e instanceof ApiError ? e.detail : 'Action impossible')
      }
    },
    [active?.slug, loadData, openDay, selectedDay]
  )

  const canManage = !!data?.can_manage
  const showPresence = data?.settings?.show_presence ?? true
  const showEvents = data?.settings?.show_events ?? true
  const selectedDayInfo = selectedDay ? daysMap.get(selectedDay) : undefined

  const handleSelectDay = (day: string) => {
    void openDay(day)
  }

  const goToday = () => {
    const t = dateToDay(today)
    setYm(ymToday())
    setWeekAnchor(startOfWeekMonday(t))
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

  const closeMobileSheet = () => setMobileSheetOpen(false)

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
        onToggleSelfPresence: (present: boolean) => void setPresence(selectedDay, present),
        onToggleDayDisabled: (disabled: boolean) => void setDayDisabled(selectedDay, disabled),
        onRemoveUser: (userId: number) => void setPresence(selectedDay, false, userId),
      }
    : null

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-2">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Agenda</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {viewMode === 'month' ? 'Vue mensuelle' : 'Vue hebdomadaire détaillée'}
              {canManage ? ' · gestion activée' : ''}
            </p>
          </div>

          <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1 self-start">
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

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 px-1">
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
            <span className="text-sm font-medium text-slate-300">Réglages d&apos;affichage</span>
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
            viewMode === 'week'
              ? 'lg:grid lg:grid-cols-[1fr_minmax(300px,340px)] lg:gap-5 lg:items-start'
              : 'lg:grid lg:grid-cols-[1fr_minmax(300px,340px)] lg:gap-5 lg:items-start'
          }
        >
          <div className="space-y-3">
            {viewMode === 'month' ? (
              <CalendarMonthGrid
                grid={grid}
                events={data?.events ?? []}
                selectedDay={selectedDay}
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
                selectedDay={selectedDay}
                today={today}
                showEvents={showEvents}
                showPresence={showPresence}
                viewerId={viewerId}
                onSelectDay={handleSelectDay}
              />
            )}

            <p className="lg:hidden text-center text-xs text-slate-500 pb-1">
              Touchez un jour pour le détail complet
            </p>
          </div>

          {panelProps && (
            <div className="hidden lg:block sticky top-[68px]">
              <CalendarDayPanel {...panelProps} variant="sidebar" />
            </div>
          )}
        </div>
      )}

      {panelProps && mobileSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
          onClick={closeMobileSheet}
        >
          <div className="w-full px-2 pb-2" onClick={(e) => e.stopPropagation()}>
            <CalendarDayPanel {...panelProps} variant="sheet" onClose={closeMobileSheet} />
          </div>
        </div>
      )}
    </div>
  )
}
