# Review package Task 5
Base: 42a8351a865938561ec9edcc5eba230b36fc43b7
Head: b5f6a4e9c4706eca7c03dc5de26e57ada3d35702

## Commits
b5f6a4e feat(pull-refresh): soft handlers mur membres alertes listes

## Stat
 .superpowers/sdd/task-5-report.md                  | 38 ++++++++++++++++++++++
 next/src/components/community/AgoraFeed.tsx        | 20 +++++++++---
 .../components/place/PlaceAnnouncementsSection.tsx | 20 +++++++++---
 next/src/components/resources/ResourceLibrary.tsx  | 13 ++++++++
 next/src/components/skills/SkillsDirectory.tsx     | 14 ++++++++
 next/src/contexts/NotificationContext.tsx          | 10 ++++--
 next/src/views/DirectoryPage.tsx                   |  1 +
 next/src/views/MembersPage.tsx                     | 29 +++++++++++++----
 next/src/views/NotificationsPage.tsx               | 12 +++++--
 next/src/views/PlaceAnnouncementsPage.tsx          | 15 +++++++--
 next/src/views/PlacesMapPage.tsx                   | 17 +++++++---
 next/src/views/ResourcesPage.tsx                   |  6 +++-
 next/src/views/SkillsPage.tsx                      |  1 +
 13 files changed, 166 insertions(+), 30 deletions(-)

## Diff
diff --git a/next/src/components/community/AgoraFeed.tsx b/next/src/components/community/AgoraFeed.tsx
index ddc5b1b..c45363f 100644
--- a/next/src/components/community/AgoraFeed.tsx
+++ b/next/src/components/community/AgoraFeed.tsx
@@ -47,18 +47,19 @@ export function AgoraFeed() {
   const [msg, setMsg] = useState<string | null>(null)
   const [wallPublicBusyId, setWallPublicBusyId] = useState<number | null>(null)
   const [reportPostId, setReportPostId] = useState<number | null>(null)
   const [reportAuthorId, setReportAuthorId] = useState<number | undefined>(undefined)
 
-  const load = useCallback(async () => {
+  const load = useCallback(async (opts?: { soft?: boolean }) => {
     if (!active?.id) {
       setPosts([])
       setCanManage(false)
       setLoading(false)
       return
     }
-    setLoading(true)
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     setError(null)
     try {
       const res = await postsApi.list(active.id, 20)
       setPosts(res.posts ?? [])
       setCanManage(!!res.can_manage)
@@ -82,10 +83,20 @@ export function AgoraFeed() {
 
   useEffect(() => {
     void load()
   }, [load])
 
+  useEffect(() => {
+    const onPull = (ev: Event) => {
+      const page = (ev as CustomEvent<{ page?: string }>).detail?.page
+      if (page !== 'home') return
+      void load({ soft: true })
+    }
+    window.addEventListener('mandala-pull-refresh', onPull)
+    return () => window.removeEventListener('mandala-pull-refresh', onPull)
+  }, [load])
+
   const pickImage = useCallback(async (file: File | null) => {
     if (!file) return
     setComposerOpen(true)
     setImageBusy(true)
     setError(null)
@@ -346,11 +357,11 @@ export function AgoraFeed() {
 
         {msg && <p className="text-sm text-emerald-400">{msg}</p>}
         {error && <p className="text-sm text-red-400">{error}</p>}
       </div>
 
-      {loading && (
+      {loading && posts.length === 0 && (
         <p className="text-sm text-slate-500">
           Chargement du mur{active?.name ? ` — ${active.name}` : ''}…
         </p>
       )}
       {!loading && posts.length === 0 && (
@@ -358,12 +369,11 @@ export function AgoraFeed() {
           Aucune publication pour le moment. Soyez le premier à partager.
         </p>
       )}
 
       <ul className="space-y-4">
-        {!loading &&
-          posts.map((p) => (
+        {posts.map((p) => (
           <li
             key={p.id}
             className={`rounded-xl border bg-slate-900/50 p-5 shadow-sm shadow-black/10 ${
               p.type === 'logistics' ? 'border-violet-800/50' : 'border-amber-800/40'
             }`}
diff --git a/next/src/components/place/PlaceAnnouncementsSection.tsx b/next/src/components/place/PlaceAnnouncementsSection.tsx
index 603eebc..90520d6 100644
--- a/next/src/components/place/PlaceAnnouncementsSection.tsx
+++ b/next/src/components/place/PlaceAnnouncementsSection.tsx
@@ -23,18 +23,19 @@ export function PlaceAnnouncementsSection({ onNavigate }: { onNavigate: MandalaN
   const [editing, setEditing] = useState<PlaceAnnouncement | null>(null)
   const [submitting, setSubmitting] = useState(false)
   const [removingId, setRemovingId] = useState<number | null>(null)
   const [wallPublicBusyId, setWallPublicBusyId] = useState<number | null>(null)
 
-  const load = useCallback(async () => {
+  const load = useCallback(async (opts?: { soft?: boolean }) => {
     if (!active?.slug) {
       setAnnouncements([])
       setCanManage(false)
       setLoading(false)
       return
     }
-    setLoading(true)
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     setError(null)
     try {
       const res = await placeAnnouncementsApi.list(active.slug, 20)
       setAnnouncements(res.announcements ?? [])
       setCanManage(!!res.can_manage)
@@ -58,10 +59,20 @@ export function PlaceAnnouncementsSection({ onNavigate }: { onNavigate: MandalaN
 
   useEffect(() => {
     void load()
   }, [load])
 
+  useEffect(() => {
+    const onPull = (ev: Event) => {
+      const page = (ev as CustomEvent<{ page?: string }>).detail?.page
+      if (page !== 'home') return
+      void load({ soft: true })
+    }
+    window.addEventListener('mandala-pull-refresh', onPull)
+    return () => window.removeEventListener('mandala-pull-refresh', onPull)
+  }, [load])
+
   const handleCreate = async (data: PlaceAnnouncementDraft) => {
     if (!active?.slug) return
     setSubmitting(true)
     setError(null)
     try {
@@ -143,11 +154,11 @@ export function PlaceAnnouncementsSection({ onNavigate }: { onNavigate: MandalaN
             </button>
           )}
         </div>
       }
     >
-      {loading && (
+      {loading && announcements.length === 0 && (
         <p className="text-sm text-slate-500">
           Chargement{active?.name ? ` — ${active.name}` : ''}…
         </p>
       )}
       {error && <p className="text-sm text-red-400">{error}</p>}
@@ -157,12 +168,11 @@ export function PlaceAnnouncementsSection({ onNavigate }: { onNavigate: MandalaN
           Aucune annonce pour le moment. Informez les membres d&apos;une nouvelle importante.
         </p>
       )}
 
       <div className="space-y-6">
-        {!loading &&
-          preview.map((a, i) => (
+        {preview.map((a, i) => (
           <div key={a.id} className={i > 0 ? 'pt-6 border-t border-amber-900/30' : ''}>
             {editing?.id === a.id ? (
               <AnnouncementEditorForm
                 initialTitle={a.title}
                 initialBody={a.body}
diff --git a/next/src/components/resources/ResourceLibrary.tsx b/next/src/components/resources/ResourceLibrary.tsx
index d97ced0..438a02a 100644
--- a/next/src/components/resources/ResourceLibrary.tsx
+++ b/next/src/components/resources/ResourceLibrary.tsx
@@ -6,21 +6,25 @@ import { ExplainCard } from '@/components/help/ExplainCard'
 import { ResourceComposer } from '@/components/resources/ResourceComposer'
 import { ResourceReader } from '@/components/resources/ResourceReader'
 import { ApiError } from '@/lib/api-client'
 import { resourceDefaultCoverUrl } from '@/lib/resource-covers'
 import { RESOURCE_KINDS, resourceKindMeta, type ResourceKind } from '@/lib/resource-constants'
+import type { MandalaPage } from '@/components/MandalaApp'
+import { registerPullRefreshHandler } from '@/lib/pull-refresh'
 
 export function ResourceLibrary({
   variant = 'app',
   communitySlug,
   communityName,
   lockToPlace = false,
+  pullRefreshPage,
 }: {
   variant?: 'app' | 'public'
   communitySlug?: string
   communityName?: string
   lockToPlace?: boolean
+  pullRefreshPage?: MandalaPage
 }) {
   const [view, setView] = useState<'place' | 'mandala'>(lockToPlace || communitySlug ? 'place' : 'mandala')
   const [query, setQuery] = useState('')
   const [kind, setKind] = useState<ResourceKind | ''>('')
   const [cards, setCards] = useState<ResourceCard[]>([])
@@ -54,10 +58,19 @@ export function ResourceLibrary({
   useEffect(() => {
     const handle = window.setTimeout(() => void load(), 200)
     return () => window.clearTimeout(handle)
   }, [load])
 
+  const onPull = useCallback(async () => {
+    await load()
+  }, [load])
+
+  useEffect(() => {
+    if (!pullRefreshPage || variant !== 'app') return
+    return registerPullRefreshHandler(pullRefreshPage, onPull)
+  }, [pullRefreshPage, variant, onPull])
+
   useEffect(() => {
     if (variant !== 'app') return
     void resourcesApi
       .mine()
       .then((res) => setHiddenMine((res.cards ?? []).filter((c) => c.scope === 'hidden').length))
diff --git a/next/src/components/skills/SkillsDirectory.tsx b/next/src/components/skills/SkillsDirectory.tsx
index e117278..ea19b28 100644
--- a/next/src/components/skills/SkillsDirectory.tsx
+++ b/next/src/components/skills/SkillsDirectory.tsx
@@ -20,10 +20,12 @@ import {
   SKILL_REGISTERS,
   type SkillRegister,
 } from '@/lib/skill-constants'
 import { ExplainCard } from '@/components/help/ExplainCard'
 import { MandalaProBadge } from '@/components/pro/MandalaProBadge'
+import type { MandalaPage } from '@/components/MandalaApp'
+import { registerPullRefreshHandler } from '@/lib/pull-refresh'
 
 const AnnuaireCitiesMap = dynamic(
   () =>
     import('@/components/public/AnnuaireCitiesMap').then((m) => m.AnnuaireCitiesMap),
   {
@@ -104,10 +106,11 @@ export function SkillsDirectory({
   onAudienceChange,
   onOpenMessages,
   onOpenConversation,
   onOpenAlerts,
   onEditProfile,
+  pullRefreshPage,
 }: {
   /** `public` : fiches ouvertes à Mandala, sans compte. */
   variant?: 'app' | 'public'
   communitySlug?: string
   communityName?: string
@@ -121,10 +124,11 @@ export function SkillsDirectory({
   onAudienceChange?: (audience: 'all' | 'pro' | 'members') => void
   onOpenMessages?: (userId: string, communitySlug?: string) => void
   onOpenConversation?: (channelId: number) => void
   onOpenAlerts?: () => void
   onEditProfile?: () => void
+  pullRefreshPage?: MandalaPage
 }) {
   const [view, setView] = useState<'place' | 'mandala'>(
     peopleDirectory ? 'mandala' : lockToPlace || communitySlug ? 'place' : 'mandala'
   )
   const [placeFilter, setPlaceFilter] = useState<'all' | 'mine' | 'unattached'>(
@@ -221,10 +225,20 @@ export function SkillsDirectory({
   useEffect(() => {
     const handle = window.setTimeout(() => void loadMap(), 180)
     return () => window.clearTimeout(handle)
   }, [loadMap])
 
+  const onPull = useCallback(async () => {
+    await load()
+    if (showMap) await loadMap()
+  }, [load, loadMap, showMap])
+
+  useEffect(() => {
+    if (!pullRefreshPage || variant !== 'app') return
+    return registerPullRefreshHandler(pullRefreshPage, onPull)
+  }, [pullRefreshPage, variant, onPull])
+
   useEffect(() => {
     if (!initialUserId) return
     setSelectedId(initialUserId)
     const t = window.setTimeout(() => {
       document
diff --git a/next/src/contexts/NotificationContext.tsx b/next/src/contexts/NotificationContext.tsx
index 9d9292b..4c2fe52 100644
--- a/next/src/contexts/NotificationContext.tsx
+++ b/next/src/contexts/NotificationContext.tsx
@@ -22,11 +22,14 @@ export type NotificationItem = {
 
 type NotificationContextValue = {
   unreadCount: number
   items: NotificationItem[]
   loading: boolean
-  fetchList: (params?: Record<string, unknown>) => Promise<unknown>
+  fetchList: (
+    params?: Record<string, unknown>,
+    opts?: { soft?: boolean },
+  ) => Promise<unknown>
   fetchUnread: () => Promise<void>
   markRead: (ids: string[]) => Promise<void>
   markAllRead: () => Promise<void>
   deleteRead: () => Promise<void>
 }
@@ -73,13 +76,14 @@ export function NotificationProvider({ children }: { children: React.ReactNode }
       /* non bloquant */
     }
   }, [userId])
 
   const fetchList = useCallback(
-    async (params: Record<string, unknown> = {}) => {
+    async (params: Record<string, unknown> = {}, opts?: { soft?: boolean }) => {
       if (!userId) return null
-      setLoading(true)
+      const soft = opts?.soft ?? false
+      if (!soft) setLoading(true)
       try {
         const data = (await notificationsApi.list(params)) as {
           items?: NotificationItem[]
           unread?: number
         }
diff --git a/next/src/views/DirectoryPage.tsx b/next/src/views/DirectoryPage.tsx
index 47084b5..0ace249 100644
--- a/next/src/views/DirectoryPage.tsx
+++ b/next/src/views/DirectoryPage.tsx
@@ -6,10 +6,11 @@ import { SkillsDirectory } from '@/components/skills/SkillsDirectory'
 export function DirectoryPage({ onNavigate }: { onNavigate: MandalaNavigate }) {
   return (
     <div className="w-full">
       <SkillsDirectory
         peopleDirectory
+        pullRefreshPage="directory"
         onOpenMessages={(userId, communitySlug) =>
           onNavigate('messages', { messagesUserId: userId, communitySlug })
         }
         onOpenConversation={(channelId) =>
           onNavigate('messages', { messagesChannelId: String(channelId) })
diff --git a/next/src/views/MembersPage.tsx b/next/src/views/MembersPage.tsx
index bd50610..56a5933 100644
--- a/next/src/views/MembersPage.tsx
+++ b/next/src/views/MembersPage.tsx
@@ -24,10 +24,11 @@ import { ExplainCard } from '@/components/help/ExplainCard'
 import { MemberCityPrompt } from '@/components/members/MemberCityPrompt'
 import { MembersCitiesMap } from '@/components/members/MembersCitiesMap'
 import { CORE_CIRCLE_LABEL } from '@/lib/community-role-labels'
 import { MandalaProBadge } from '@/components/pro/MandalaProBadge'
 import { PlaceMemberCapBanner } from '@/components/billing/PlaceMemberCapBanner'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
 
 type MemberCardData = CommunityMember | MemberDirectoryEntry
 
 function sortMembersAz<
   T extends {
@@ -81,17 +82,18 @@ export function MembersPage({
   const [manageUserId, setManageUserId] = useState<number | null>(null)
   const [removeTarget, setRemoveTarget] = useState<{ userId: number; label: string } | null>(null)
   const [removing, setRemoving] = useState(false)
   const [circleBusyId, setCircleBusyId] = useState<number | null>(null)
 
-  const loadCommunity = useCallback(async () => {
+  const loadCommunity = useCallback(async (opts?: { soft?: boolean }) => {
     if (!active?.slug) {
       setCommunityMembers([])
       setLoading(false)
       return
     }
-    setLoading(true)
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     setError(null)
     try {
       const data = (await membersApi.listCommunity(active.slug)) as { members?: CommunityMember[] }
       setCommunityMembers(data.members ?? [])
     } catch (e: unknown) {
@@ -100,12 +102,13 @@ export function MembersPage({
     } finally {
       setLoading(false)
     }
   }, [active?.slug])
 
-  const loadDirectory = useCallback(async () => {
-    setDirectoryLoading(true)
+  const loadDirectory = useCallback(async (opts?: { soft?: boolean }) => {
+    const soft = opts?.soft ?? false
+    if (!soft || directoryMembers.length === 0) setDirectoryLoading(true)
     setDirectoryError(null)
     try {
       const data = await membersApi.directory()
       setDirectoryCommunities(data.communities ?? [])
       setDirectoryMembers(data.members ?? [])
@@ -116,11 +119,21 @@ export function MembersPage({
       setDirectoryCommunities([])
       setDirectoryMembers([])
     } finally {
       setDirectoryLoading(false)
     }
-  }, [])
+  }, [directoryMembers.length])
+
+  const onPull = useCallback(async () => {
+    if (directoryMode) {
+      await loadDirectory({ soft: true })
+    } else {
+      await loadCommunity({ soft: true })
+    }
+  }, [directoryMode, loadCommunity, loadDirectory])
+  useRegisterPullRefresh('members', onPull)
+  useRegisterPullRefresh('place-members', onPull)
 
   useEffect(() => {
     void loadCommunity()
   }, [loadCommunity])
 
@@ -348,21 +361,23 @@ export function MembersPage({
           Gérez les fiches membres ou retirez une personne du lieu. Le retrait efface ses données sur
           ce lieu (calendrier, Agora, météo…) sans supprimer son compte Mandala.
         </p>
       )}
 
-      {(loading || (directoryMode && directoryLoading)) && (
+      {((loading && communityMembers.length === 0) ||
+        (directoryMode && directoryLoading && directoryMembers.length === 0)) && (
         <p className="text-slate-400 text-sm">Chargement…</p>
       )}
       {(error || (directoryMode && directoryError)) && (
         <p className="text-red-400 text-sm">{directoryMode ? directoryError : error}</p>
       )}
       {actionMsg && <p className="text-emerald-400 text-sm">{actionMsg}</p>}
 
       <div className="flex gap-4">
         <div className="flex-1 min-w-0">
-          {!loading && !(directoryMode && directoryLoading) && (
+          {(!(loading && communityMembers.length === 0) &&
+            !(directoryMode && directoryLoading && directoryMembers.length === 0)) && (
             <MemberGrid
               members={displayMembers}
               directoryMode={directoryMode}
               activeSlug={activeSlug}
               onOpenMessages={onOpenMessages}
diff --git a/next/src/views/NotificationsPage.tsx b/next/src/views/NotificationsPage.tsx
index adb12a5..ab6e9d4 100644
--- a/next/src/views/NotificationsPage.tsx
+++ b/next/src/views/NotificationsPage.tsx
@@ -1,8 +1,9 @@
 'use client'
 
-import { useEffect, useState } from 'react'
+import { useCallback, useEffect, useState } from 'react'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
 import { useNotifications } from '@/contexts/NotificationContext'
 import { useCommunity } from '@/contexts/CommunityContext'
 import type { MandalaNavigate } from '@/components/MandalaApp'
 import { ExplainCard } from '@/components/help/ExplainCard'
 import { navigateFromNotification } from '@/lib/notification-navigation'
@@ -18,10 +19,15 @@ export function NotificationsPage({ onNavigate }: { onNavigate?: MandalaNavigate
 
   useEffect(() => {
     void fetchList({ per_page: 50 })
   }, [fetchList])
 
+  const onPull = useCallback(async () => {
+    await fetchList({ per_page: 50 }, { soft: true })
+  }, [fetchList])
+  useRegisterPullRefresh('notifications', onPull)
+
   const openNotification = (n: NotificationItem) => {
     if (!onNavigate) return
     if (!n.read_at) void markRead([n.id])
     void navigateFromNotification(n, {
       onNavigate,
@@ -65,11 +71,13 @@ export function NotificationsPage({ onNavigate }: { onNavigate?: MandalaNavigate
             </button>
           )}
         </div>
       </div>
 
-      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
+      {loading && inbox.length === 0 && (
+        <p className="text-slate-500 text-sm">Chargement…</p>
+      )}
 
       {!loading && unread.length === 0 && read.length === 0 && (
         <p className="text-slate-500 text-sm italic">Aucune notification pour le moment.</p>
       )}
 
diff --git a/next/src/views/PlaceAnnouncementsPage.tsx b/next/src/views/PlaceAnnouncementsPage.tsx
index 1e7a40a..adcb8ac 100644
--- a/next/src/views/PlaceAnnouncementsPage.tsx
+++ b/next/src/views/PlaceAnnouncementsPage.tsx
@@ -4,10 +4,11 @@ import { useCallback, useEffect, useState } from 'react'
 import type { MandalaNavigate } from '@/components/MandalaApp'
 import { placeAnnouncementsApi, type PlaceAnnouncement, type PlaceAnnouncementDraft } from '@/api/place-announcements'
 import { ExplainCard } from '@/components/help/ExplainCard'
 import { useCommunity } from '@/contexts/CommunityContext'
 import { ApiError } from '@/lib/api-client'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
 import {
   AnnouncementEditorForm,
   PlaceAnnouncementCard,
 } from '@/components/place/PlaceAnnouncementCard'
 
@@ -21,13 +22,14 @@ export function PlaceAnnouncementsPage({ onNavigate }: { onNavigate: MandalaNavi
   const [editing, setEditing] = useState<PlaceAnnouncement | null>(null)
   const [submitting, setSubmitting] = useState(false)
   const [removingId, setRemovingId] = useState<number | null>(null)
   const [wallPublicBusyId, setWallPublicBusyId] = useState<number | null>(null)
 
-  const load = useCallback(async () => {
+  const load = useCallback(async (opts?: { soft?: boolean }) => {
     if (!active?.slug) return
-    setLoading(true)
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     setError(null)
     try {
       const res = await placeAnnouncementsApi.list(active.slug, 50)
       setAnnouncements(res.announcements ?? [])
       setCanManage(!!res.can_manage)
@@ -41,10 +43,15 @@ export function PlaceAnnouncementsPage({ onNavigate }: { onNavigate: MandalaNavi
 
   useEffect(() => {
     void load()
   }, [load])
 
+  const onPull = useCallback(async () => {
+    await load({ soft: true })
+  }, [load])
+  useRegisterPullRefresh('place-announcements', onPull)
+
   const handleCreate = async (data: PlaceAnnouncementDraft) => {
     if (!active?.slug) return
     setSubmitting(true)
     try {
       await placeAnnouncementsApi.create({ community_slug: active.slug, ...data })
@@ -138,11 +145,13 @@ export function PlaceAnnouncementsPage({ onNavigate }: { onNavigate: MandalaNavi
             onCancel={() => setComposerOpen(false)}
           />
         </section>
       )}
 
-      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
+      {loading && announcements.length === 0 && (
+        <p className="text-slate-500 text-sm">Chargement…</p>
+      )}
 
       <ul className="space-y-4">
         {announcements.map((a) => (
           <li
             key={a.id}
diff --git a/next/src/views/PlacesMapPage.tsx b/next/src/views/PlacesMapPage.tsx
index 5314993..c1fd8b6 100644
--- a/next/src/views/PlacesMapPage.tsx
+++ b/next/src/views/PlacesMapPage.tsx
@@ -3,10 +3,11 @@
 import { useCallback, useEffect, useState } from 'react'
 import dynamic from 'next/dynamic'
 import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
 import { placeLinksApi } from '@/api/place-links'
 import { PlacesCarousel } from '@/components/landing/PlacesCarousel'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
 
 const PlacesMap = dynamic(
   () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
   {
     ssr: false,
@@ -26,12 +27,13 @@ export function PlacesMapPage() {
   const [places, setPlaces] = useState<PublicCommunityCard[]>([])
   const [loading, setLoading] = useState(true)
   const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
   const [friendIds, setFriendIds] = useState<number[]>([])
 
-  const loadPlaces = useCallback(async () => {
-    setLoading(true)
+  const loadPlaces = useCallback(async (opts?: { soft?: boolean }) => {
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     try {
       const res = await communitiesApi.publicList()
       setPlaces(res.items ?? [])
     } catch {
       setPlaces([])
@@ -42,10 +44,15 @@ export function PlacesMapPage() {
 
   useEffect(() => {
     void loadPlaces()
   }, [loadPlaces])
 
+  const onPull = useCallback(async () => {
+    await loadPlaces({ soft: true })
+  }, [loadPlaces])
+  useRegisterPullRefresh('places-map', onPull)
+
   useEffect(() => {
     if (!selectedSlug) {
       setFriendIds([])
       return
     }
@@ -110,19 +117,21 @@ export function PlacesMapPage() {
         <h2 className="text-lg font-semibold">Les lieux inscrits</h2>
         <p className="text-sm text-slate-500">
           Faites défiler pour découvrir chaque lieu du réseau.
         </p>
 
-        {loading && <p className="text-sm text-slate-500">Chargement des lieux…</p>}
+        {loading && places.length === 0 && (
+          <p className="text-sm text-slate-500">Chargement des lieux…</p>
+        )}
 
         {!loading && places.length === 0 && (
           <p className="text-sm text-slate-500 rounded-xl border border-slate-800 p-6 text-center">
             Aucun lieu publié pour le moment.
           </p>
         )}
 
-        {!loading && places.length > 0 && (
+        {places.length > 0 && (
           <PlacesCarousel
             places={places}
             selectedSlug={selectedSlug}
             onSelect={setSelectedSlug}
             showRelier
diff --git a/next/src/views/ResourcesPage.tsx b/next/src/views/ResourcesPage.tsx
index 750b2c9..a696800 100644
--- a/next/src/views/ResourcesPage.tsx
+++ b/next/src/views/ResourcesPage.tsx
@@ -7,9 +7,13 @@ import { useCommunity } from '@/contexts/CommunityContext'
 export function ResourcesPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
   const { active } = useCommunity()
   void onNavigate
   return (
     <div className="w-full">
-      <ResourceLibrary communitySlug={active?.slug} communityName={active?.name} />
+      <ResourceLibrary
+        communitySlug={active?.slug}
+        communityName={active?.name}
+        pullRefreshPage="resources"
+      />
     </div>
   )
 }
diff --git a/next/src/views/SkillsPage.tsx b/next/src/views/SkillsPage.tsx
index a4318ae..2c266ce 100644
--- a/next/src/views/SkillsPage.tsx
+++ b/next/src/views/SkillsPage.tsx
@@ -22,10 +22,11 @@ export function SkillsPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
     <div className="w-full">
       <SkillsDirectory
         communitySlug={active?.slug}
         communityName={active?.name}
         initialUserId={openUserId}
+        pullRefreshPage="skills"
         onOpenMessages={
           onNavigate
             ? (userId, communitySlug) =>
                 onNavigate('messages', { messagesUserId: userId, communitySlug })
             : undefined

