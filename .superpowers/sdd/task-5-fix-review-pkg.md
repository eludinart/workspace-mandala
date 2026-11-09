# Task 5 fix review
Base: b5f6a4e9c4706eca7c03dc5de26e57ada3d35702
Head: 6ea709423766231d9d4f9afd6c4a84819527a4e6

## Stat
 .superpowers/sdd/task-5-report.md                |  7 ++++++-
 next/src/components/wall/WallDiscoverSection.tsx | 15 +++++++++++++--
 next/src/components/wall/WallFeed.tsx            | 15 +++++++++++++--
 next/src/views/DiscoverWallPage.tsx              |  7 +++++++
 next/src/views/MembersPage.tsx                   |  4 ++--
 next/src/views/PlacesMapPage.tsx                 |  7 -------
 6 files changed, 41 insertions(+), 14 deletions(-)

## Diff
diff --git a/.superpowers/sdd/task-5-report.md b/.superpowers/sdd/task-5-report.md
index 3778be6..e97b6e5 100644
--- a/.superpowers/sdd/task-5-report.md
+++ b/.superpowers/sdd/task-5-report.md
@@ -4,11 +4,11 @@
 
 **Done** — typecheck passes (`npm run typecheck`).
 
 ## Commit
 
-`feat(pull-refresh): soft handlers mur membres alertes listes`
+`b5f6a4e` — `feat(pull-refresh): soft handlers mur membres alertes listes`
 
 ## Summary
 
 | Area | Mechanism |
 |------|-----------|
@@ -34,5 +34,10 @@
 - **NotificationContext** `fetchList` signature extended with optional second arg; callers unchanged except NotificationsPage pull.
 
 ## Files touched
 
 13 files under `next/src/` (components, views, NotificationContext).
+
+## Review fixes (Task 5 findings)
+
+- **places-map**: `DiscoverWallPage` registers `useRegisterPullRefresh('places-map', …)` and dispatches `mandala-pull-refresh` with `page: 'places-map'`. `WallDiscoverSection` + `WallFeed` listen and soft-refetch map/places and wall feed without blanking. Removed dead `PlacesMapPage` registration (view not mounted in `MandalaApp`).
+- **MembersPage `loadDirectory`**: `if (!soft) setDirectoryLoading(true)`; `useCallback` deps `[]` (no `directoryMembers.length`).
diff --git a/next/src/components/wall/WallDiscoverSection.tsx b/next/src/components/wall/WallDiscoverSection.tsx
index c432f30..528e694 100644
--- a/next/src/components/wall/WallDiscoverSection.tsx
+++ b/next/src/components/wall/WallDiscoverSection.tsx
@@ -43,12 +43,13 @@ export function WallDiscoverSection({
   const [loading, setLoading] = useState(true)
   const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
   const [friendIds, setFriendIds] = useState<number[]>([])
   const [mapFullscreen, setMapFullscreen] = useState(false)
 
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
@@ -59,10 +60,20 @@ export function WallDiscoverSection({
 
   useEffect(() => {
     void loadPlaces()
   }, [loadPlaces])
 
+  useEffect(() => {
+    const onPull = (ev: Event) => {
+      const page = (ev as CustomEvent<{ page?: string }>).detail?.page
+      if (page !== 'places-map') return
+      void loadPlaces({ soft: true })
+    }
+    window.addEventListener('mandala-pull-refresh', onPull)
+    return () => window.removeEventListener('mandala-pull-refresh', onPull)
+  }, [loadPlaces])
+
   useEffect(() => {
     if (!selectedSlug) {
       setFriendIds([])
       return
     }
diff --git a/next/src/components/wall/WallFeed.tsx b/next/src/components/wall/WallFeed.tsx
index 6bc217c..8d2b85e 100644
--- a/next/src/components/wall/WallFeed.tsx
+++ b/next/src/components/wall/WallFeed.tsx
@@ -54,12 +54,13 @@ export function WallFeed({
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)
   const [isAuthenticated, setIsAuthenticated] = useState(false)
   const [memberPlaceCount, setMemberPlaceCount] = useState(0)
 
-  const load = useCallback(async () => {
-    setLoading(true)
+  const load = useCallback(async (opts?: { soft?: boolean }) => {
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     setError(null)
     try {
       if (channel === 'people') {
         const res = await skillsApi.notes(limit)
         setNotes(res.notes ?? [])
@@ -87,10 +88,20 @@ export function WallFeed({
     const onEventsChanged = () => void load()
     window.addEventListener('mandala-events-changed', onEventsChanged)
     return () => window.removeEventListener('mandala-events-changed', onEventsChanged)
   }, [load])
 
+  useEffect(() => {
+    const onPull = (ev: Event) => {
+      const page = (ev as CustomEvent<{ page?: string }>).detail?.page
+      if (page !== 'places-map') return
+      void load({ soft: true })
+    }
+    window.addEventListener('mandala-pull-refresh', onPull)
+    return () => window.removeEventListener('mandala-pull-refresh', onPull)
+  }, [load])
+
   const visibleItems = useMemo(
     () => filterPastEvents(items, showPastEvents),
     [items, showPastEvents],
   )
   const hiddenPastCount = useMemo(
diff --git a/next/src/views/DiscoverWallPage.tsx b/next/src/views/DiscoverWallPage.tsx
index e8612d7..0dd7c0d 100644
--- a/next/src/views/DiscoverWallPage.tsx
+++ b/next/src/views/DiscoverWallPage.tsx
@@ -1,18 +1,25 @@
 'use client'
 
+import { useCallback } from 'react'
 import type { MandalaNavigate } from '@/components/MandalaApp'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
 import { ExplainCard } from '@/components/help/ExplainCard'
 import { SkillsCarousel } from '@/components/landing/SkillsCarousel'
 import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'
 import { OPEN_SKILL_USER_KEY, queueSkillFiche } from '@/components/skills/SkillsDirectory'
 
 /**
  * Mur d'actualité + carte du réseau (espace connecté `/app`).
  * Remplace l'ancienne « Carte des lieux » par une vue unifiée découverte.
  */
 export function DiscoverWallPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
+  const onPull = useCallback(async () => {
+    window.dispatchEvent(new CustomEvent('mandala-pull-refresh', { detail: { page: 'places-map' } }))
+  }, [])
+  useRegisterPullRefresh('places-map', onPull)
+
   return (
     <div className="m-landing w-full space-y-8 pb-8">
       <ExplainCard screen="discover" />
       <header className="text-center sm:text-left space-y-3 pt-1">
         <p className="m-landing-eyebrow">Réseau Mandala</p>
diff --git a/next/src/views/MembersPage.tsx b/next/src/views/MembersPage.tsx
index 56a5933..d5b1439 100644
--- a/next/src/views/MembersPage.tsx
+++ b/next/src/views/MembersPage.tsx
@@ -104,11 +104,11 @@ export function MembersPage({
     }
   }, [active?.slug])
 
   const loadDirectory = useCallback(async (opts?: { soft?: boolean }) => {
     const soft = opts?.soft ?? false
-    if (!soft || directoryMembers.length === 0) setDirectoryLoading(true)
+    if (!soft) setDirectoryLoading(true)
     setDirectoryError(null)
     try {
       const data = await membersApi.directory()
       setDirectoryCommunities(data.communities ?? [])
       setDirectoryMembers(data.members ?? [])
@@ -119,11 +119,11 @@ export function MembersPage({
       setDirectoryCommunities([])
       setDirectoryMembers([])
     } finally {
       setDirectoryLoading(false)
     }
-  }, [directoryMembers.length])
+  }, [])
 
   const onPull = useCallback(async () => {
     if (directoryMode) {
       await loadDirectory({ soft: true })
     } else {
diff --git a/next/src/views/PlacesMapPage.tsx b/next/src/views/PlacesMapPage.tsx
index c1fd8b6..e8f6c78 100644
--- a/next/src/views/PlacesMapPage.tsx
+++ b/next/src/views/PlacesMapPage.tsx
@@ -3,12 +3,10 @@
 import { useCallback, useEffect, useState } from 'react'
 import dynamic from 'next/dynamic'
 import { communitiesApi, type PublicCommunityCard } from '@/api/communities'
 import { placeLinksApi } from '@/api/place-links'
 import { PlacesCarousel } from '@/components/landing/PlacesCarousel'
-import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
-
 const PlacesMap = dynamic(
   () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
   {
     ssr: false,
     loading: () => (
@@ -44,15 +42,10 @@ export function PlacesMapPage() {
 
   useEffect(() => {
     void loadPlaces()
   }, [loadPlaces])
 
-  const onPull = useCallback(async () => {
-    await loadPlaces({ soft: true })
-  }, [loadPlaces])
-  useRegisterPullRefresh('places-map', onPull)
-
   useEffect(() => {
     if (!selectedSlug) {
       setFriendIds([])
       return
     }

