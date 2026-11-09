### Task 5: Soft handlers — Agora, Annonces, Membres, Alertes, listes

**Files:**
- Modify: `next/src/components/community/AgoraFeed.tsx`
- Modify: `next/src/components/place/PlaceAnnouncementsSection.tsx`
- Modify: `next/src/views/PlaceAnnouncementsPage.tsx`
- Modify: `next/src/views/MembersPage.tsx`
- Modify: `next/src/views/NotificationsPage.tsx`
- Modify: `next/src/views/PlacesMapPage.tsx`
- And resources / skills / directory views that hold the fetch (`ResourcesPage`, skills directory page, `DirectoryPage`) — locate exact files and register.

**Interfaces:**
- Consumes: `useRegisterPullRefresh` and/or `window` event `mandala-pull-refresh`

**Pattern A (page owns fetch):** `useRegisterPullRefresh('members', loadCommunity)` (and directory mode → `loadDirectory`).

**Pattern B (section on Home):** listen to `mandala-pull-refresh` when `detail.page === 'home'` and call existing `load()` without emptying UI first (keep current items while fetching). Prefer not setting `loading=true` on pull if that blanks the list — use a local `refreshing` flag or call API then `setPosts` only.

For Agora / Annonces on Home:

```ts
useEffect(() => {
  const onPull = (ev: Event) => {
    const page = (ev as CustomEvent<{ page?: string }>).detail?.page
    if (page !== 'home') return
    void load()
  }
  window.addEventListener('mandala-pull-refresh', onPull)
  return () => window.removeEventListener('mandala-pull-refresh', onPull)
}, [load])
```

Adjust `load()` so pull does not clear the list (`setLoading(true)` only when empty / first load). Same for announcements.

- [ ] **Step 1: Wire Agora + Annonces (home event + place-announcements page register)**
- [ ] **Step 2: Wire Members (`members` + `place-members` via organisationMode / same component — register both pages if the component is reused, or pass page id)**
- [ ] **Step 3: Wire Notifications (`fetchList`), PlacesMap (`loadPlaces`), Resources / Skills / Directory**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(pull-refresh): soft handlers mur membres alertes listes"
```

---

