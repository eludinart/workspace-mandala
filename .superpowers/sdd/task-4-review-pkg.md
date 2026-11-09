# Review package Task 4
Base: ba6f2ebbd5aadd407ada3064e95de4bc5c216134
Head: 0abf327f2848c7bc9d88de3f42a224947882ad41

## Commits
0abf327 feat(pull-refresh): soft refetch Accueil Events Calendar

## Stat
 next/src/views/CalendarPage.tsx | 40 +++++++++++++++++++++-----
 next/src/views/EventsPage.tsx   | 62 ++++++++++++++++++++++++++++++++++++++---
 next/src/views/HomePage.tsx     | 17 +++++++++--
 3 files changed, 106 insertions(+), 13 deletions(-)

## Diff
diff --git a/next/src/views/CalendarPage.tsx b/next/src/views/CalendarPage.tsx
index af5b2cb..055a630 100644
--- a/next/src/views/CalendarPage.tsx
+++ b/next/src/views/CalendarPage.tsx
@@ -1,23 +1,26 @@
 'use client'
 
 import { useCallback, useEffect, useMemo, useState } from 'react'
+import { useQueryClient } from '@tanstack/react-query'
 import { calendarApi } from '@/api/calendar'
 import { useCommunity } from '@/contexts/CommunityContext'
 import { useAuth } from '@/contexts/AuthContext'
 import { parseWallClockDateTime } from '@/lib/format-datetime'
 import { enumerateEventDays, getEventSpanPosition } from '@/lib/event-dates'
 import { ApiError } from '@/lib/api-client'
 import { eventsApi } from '@/api/events'
 import { emitEventsChanged } from '@/lib/events-changed'
 import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid'
 import { CalendarWeekView } from '@/components/calendar/CalendarWeekView'
 import { CalendarDayPanel, type DayDetailData } from '@/components/calendar/CalendarDayPanel'
 import { ExplainCard } from '@/components/help/ExplainCard'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
+import { queryKeys } from '@/lib/query-keys'
 import {
   type CalendarViewMode,
   type DayEvent,
   type MonthData,
   type MonthDay,
   addMonths,
   addWeeks,
   dateToDay,
@@ -29,17 +32,18 @@ import {
   weekDaysFromMonday,
   weekLabelFr,
   weekdayHeadersFr,
   ymsForWeek,
   ymToday,
 } from '@/components/calendar/calendar-utils'
 
 export function CalendarPage() {
-  const { active } = useCommunity()
+  const queryClient = useQueryClient()
+  const { active, refresh: refreshCommunities } = useCommunity()
   const { user } = useAuth()
   const viewerId = user?.id != null ? Number(user.id) : null
   const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
   const [ym, setYm] = useState(ymToday())
   const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekMonday(dateToDay(new Date())))
   const [data, setData] = useState<MonthData | null>(null)
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)
@@ -52,36 +56,41 @@ export function CalendarPage() {
   const [detailLoading, setDetailLoading] = useState(false)
   const [actionMsg, setActionMsg] = useState<string | null>(null)
   const [presenceBusy, setPresenceBusy] = useState(false)
   const [adminOpen, setAdminOpen] = useState(false)
 
   const today = useMemo(() => new Date(), [])
   const weekDays = useMemo(() => weekDaysFromMonday(weekAnchor), [weekAnchor])
 
-  const loadData = useCallback(async () => {
+  const loadData = useCallback(async (opts?: { background?: boolean }) => {
     if (!active?.slug) return
-    setLoading(true)
-    setError(null)
+    const background = opts?.background === true
+    if (!background) {
+      setLoading(true)
+      setError(null)
+    }
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
-      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
-      setData(null)
+      if (!background) {
+        setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
+        setData(null)
+      }
     } finally {
-      setLoading(false)
+      if (!background) setLoading(false)
     }
   }, [active?.slug, ym, viewMode, weekAnchor])
 
   useEffect(() => {
     void loadData()
   }, [loadData])
 
   // Switch de lieu : ne pas garder le panneau jour / multi-select de l’ancien lieu.
@@ -158,16 +167,33 @@ export function CalendarPage() {
         setActionMsg(e instanceof ApiError ? e.detail : 'Impossible de charger le détail du jour')
       } finally {
         setDetailLoading(false)
       }
     },
     [active?.slug]
   )
 
+  const onPull = useCallback(async () => {
+    await refreshCommunities({ background: true })
+    if (active?.slug) {
+      await queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(active.slug) })
+    }
+    await loadData({ background: true })
+    if (selectedDay) await openDay(selectedDay)
+  }, [
+    active?.slug,
+    loadData,
+    openDay,
+    queryClient,
+    refreshCommunities,
+    selectedDay,
+  ])
+  useRegisterPullRefresh('calendar', onPull)
+
   useEffect(() => {
     if (!active?.slug) return
     let t: number | undefined
     const onEventsChanged = (ev: Event) => {
       const detail = (ev as CustomEvent<{ communitySlug?: string }>).detail
       if (detail?.communitySlug !== active.slug) return
       if (t) window.clearTimeout(t)
       t = window.setTimeout(() => {
diff --git a/next/src/views/EventsPage.tsx b/next/src/views/EventsPage.tsx
index 85cc5e1..f7c270b 100644
--- a/next/src/views/EventsPage.tsx
+++ b/next/src/views/EventsPage.tsx
@@ -1,19 +1,24 @@
 'use client'
 
-import { useEffect, useMemo, useRef, useState } from 'react'
+import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
+import { useQueryClient } from '@tanstack/react-query'
 import { eventsApi } from '@/api/events'
+import { calendarApi } from '@/api/calendar'
 import { ExplainCard } from '@/components/help/ExplainCard'
 import { useCommunity } from '@/contexts/CommunityContext'
 import { useNotifyPlaceEventsChanged, usePlaceEvents } from '@/hooks/usePlaceEvents'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
+import { queryKeys } from '@/lib/query-keys'
 import { EventDetailPage } from '@/views/EventDetailPage'
 import { EventPreviewCard } from '@/components/events/EventPreviewCard'
 import { EventDetailModal } from '@/components/events/EventDetailModal'
 import { EVENT_PHASES } from '@/lib/event-constants'
+import { enumerateEventDays } from '@/lib/event-dates'
 import { type HomeEventPreview, isEventUpcoming } from '@/lib/event-preview'
 import { parseWallClockDateTime } from '@/lib/format-datetime'
 import { ApiError } from '@/lib/api-client'
 
 function phaseLabel(id: string) {
   return EVENT_PHASES.find((p) => p.id === id)?.label ?? id
 }
 
@@ -51,35 +56,48 @@ function CreateEventWizard({
   onCreated: (eventId: number) => void
 }) {
   const [step, setStep] = useState(1)
   const [title, setTitle] = useState('')
   const [description, setDescription] = useState('')
   const [location, setLocation] = useState('')
   const [startsAt, setStartsAt] = useState('')
   const [endsAt, setEndsAt] = useState('')
+  const [openCalendarDays, setOpenCalendarDays] = useState(true)
   const [submitting, setSubmitting] = useState(false)
   const [error, setError] = useState<string | null>(null)
 
   const canNextStep1 = title.trim().length > 0
 
   const submit = async () => {
     if (!title.trim()) return
     setSubmitting(true)
     setError(null)
     try {
+      const starts_at = startsAt ? startsAt.replace('T', ' ') : undefined
+      const ends_at = endsAt ? endsAt.replace('T', ' ') : undefined
       const res = (await eventsApi.create({
         community_slug: communitySlug,
         title: title.trim(),
         description: description.trim() || undefined,
         location: location.trim() || undefined,
-        starts_at: startsAt ? startsAt.replace('T', ' ') : undefined,
-        ends_at: endsAt ? endsAt.replace('T', ' ') : undefined,
+        starts_at,
+        ends_at,
         phase: 'preparation',
       })) as { event?: { id: number } }
+      if (openCalendarDays && starts_at) {
+        const days = enumerateEventDays(starts_at, ends_at ?? null)
+        if (days.length > 0) {
+          await calendarApi.setDays({
+            community_slug: communitySlug,
+            days,
+            is_disabled: false,
+          })
+        }
+      }
       if (res.event?.id) onCreated(res.event.id)
       else onClose()
     } catch (e: unknown) {
       setError(e instanceof ApiError ? e.detail : 'Création impossible')
     } finally {
       setSubmitting(false)
     }
   }
@@ -145,16 +163,33 @@ function CreateEventWizard({
             Date et heure de fin (optionnel)
             <input
               type="datetime-local"
               value={endsAt}
               onChange={(e) => setEndsAt(e.target.value)}
               className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
             />
           </label>
+          <label className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 cursor-pointer">
+            <input
+              type="checkbox"
+              className="mt-0.5"
+              checked={openCalendarDays}
+              onChange={(e) => setOpenCalendarDays(e.target.checked)}
+              disabled={!startsAt}
+            />
+            <span>
+              <span className="block text-sm text-slate-200">Ouvrir ces jours dans l’agenda</span>
+              <span className="block text-[11px] text-slate-500 mt-0.5">
+                {startsAt
+                  ? 'Les membres pourront s’inscrire « Je viens » sur ces dates.'
+                  : 'Indiquez d’abord une date de début.'}
+              </span>
+            </span>
+          </label>
         </div>
       )}
       {step === 3 && (
         <div className="space-y-2 text-sm">
           <p className="text-slate-400 text-xs uppercase tracking-wide">Récapitulatif</p>
           <dl className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
             <div>
               <dt className="text-slate-500 text-xs">Titre</dt>
@@ -173,16 +208,26 @@ function CreateEventWizard({
             <div>
               <dt className="text-slate-500 text-xs">Début</dt>
               <dd>{startsAt ? startsAt.replace('T', ' ') : '—'}</dd>
             </div>
             <div>
               <dt className="text-slate-500 text-xs">Fin</dt>
               <dd>{endsAt ? endsAt.replace('T', ' ') : '—'}</dd>
             </div>
+            <div>
+              <dt className="text-slate-500 text-xs">Agenda</dt>
+              <dd>
+                {startsAt && openCalendarDays
+                  ? 'Jours ouverts à la création'
+                  : startsAt
+                    ? 'Jours non ouverts automatiquement'
+                    : '—'}
+              </dd>
+            </div>
             <div>
               <dt className="text-slate-500 text-xs">Phase initiale</dt>
               <dd>{phaseLabel('preparation')}</dd>
             </div>
           </dl>
         </div>
       )}
       {error && <p className="text-red-400 text-sm">{error}</p>}
@@ -230,19 +275,28 @@ function CreateEventWizard({
 
 export function EventsPage({
   openEventId,
   onOpenEvent,
 }: {
   openEventId?: number | null
   onOpenEvent?: (id: number | null) => void
 }) {
-  const { active } = useCommunity()
+  const queryClient = useQueryClient()
+  const { active, refresh: refreshCommunities } = useCommunity()
   const eventsQuery = usePlaceEvents(active?.slug)
   const notifyEventsChanged = useNotifyPlaceEventsChanged()
+
+  const onPull = useCallback(async () => {
+    await refreshCommunities({ background: true })
+    if (active?.slug) {
+      await queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(active.slug) })
+    }
+  }, [active?.slug, queryClient, refreshCommunities])
+  useRegisterPullRefresh('events', onPull)
   const events = eventsQuery.data?.events ?? []
   const elsewhere = eventsQuery.data?.elsewhere ?? []
   const canManage = eventsQuery.data?.can_manage ?? false
   const loading = eventsQuery.isLoading
   const refreshing = eventsQuery.isFetching && !eventsQuery.isLoading
   const error =
     eventsQuery.error instanceof ApiError
       ? eventsQuery.error.detail
diff --git a/next/src/views/HomePage.tsx b/next/src/views/HomePage.tsx
index 1f107e2..ffd2ad4 100644
--- a/next/src/views/HomePage.tsx
+++ b/next/src/views/HomePage.tsx
@@ -1,14 +1,17 @@
 'use client'
 
-import { useEffect, useState } from 'react'
+import { useCallback, useEffect, useState } from 'react'
+import { useQueryClient } from '@tanstack/react-query'
 import type { MandalaNavigate } from '@/components/MandalaApp'
 import { useCommunity } from '@/contexts/CommunityContext'
 import { usePlaceEvents } from '@/hooks/usePlaceEvents'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
+import { queryKeys } from '@/lib/query-keys'
 import {
   descriptionExcerpt,
   formatEventDateRange,
   isEventOnDay,
   pickFeaturedEvent,
   pickOtherUpcoming,
 } from '@/lib/event-preview'
 import {
@@ -30,18 +33,28 @@ function eventDateParts(startsAt: string | null): { day: string; month: string }
   if (!d) return null
   return {
     day: String(d.getDate()).padStart(2, '0'),
     month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
   }
 }
 
 export function HomePage({ onNavigate }: { onNavigate: MandalaNavigate }) {
-  const { active } = useCommunity()
+  const queryClient = useQueryClient()
+  const { active, refresh: refreshCommunities } = useCommunity()
   const eventsQuery = usePlaceEvents(active?.slug)
+
+  const onPull = useCallback(async () => {
+    await refreshCommunities({ background: true })
+    if (active?.slug) {
+      await queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(active.slug) })
+    }
+    window.dispatchEvent(new CustomEvent('mandala-pull-refresh', { detail: { page: 'home' } }))
+  }, [active?.slug, queryClient, refreshCommunities])
+  useRegisterPullRefresh('home', onPull)
   const events = eventsQuery.data?.events ?? []
   const elsewhere = eventsQuery.data?.elsewhere ?? []
   const canManage = eventsQuery.data?.can_manage ?? false
   const loading = eventsQuery.isLoading
   const refreshing = eventsQuery.isFetching && !eventsQuery.isLoading
   const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
   const [joinOpen, setJoinOpen] = useState(false)
   const accent = active?.accent_color ?? '#7c3aed'

