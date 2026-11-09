### Task 4: Soft handlers — Query + Accueil / Events / Calendar / communautés

**Files:**
- Modify: `next/src/views/HomePage.tsx`
- Modify: `next/src/views/EventsPage.tsx`
- Modify: `next/src/views/CalendarPage.tsx`
- Create or modify small helper if needed inside each file

**Interfaces:**
- Consumes: `useRegisterPullRefresh`, `useQueryClient`, `queryKeys`, `useCommunity().refresh`

- [ ] **Step 1: HomePage**

Register handler (stable `useCallback`):

```ts
const queryClient = useQueryClient()
const { active, refresh: refreshCommunities } = useCommunity()
const onPull = useCallback(async () => {
  await refreshCommunities({ background: true })
  if (active?.slug) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(active.slug) })
  }
  window.dispatchEvent(new CustomEvent('mandala-pull-refresh', { detail: { page: 'home' } }))
}, [active?.slug, queryClient, refreshCommunities])
useRegisterPullRefresh('home', onPull)
```

- [ ] **Step 2: EventsPage + CalendarPage**

Same pattern: `invalidateQueries(placeEvents)` + `refreshCommunities({ background: true })` ; register for `'events'` / `'calendar'`.

Calendar may also re-fetch day data if it has a local `load` — call it inside the handler if present.

- [ ] **Step 3: Commit**

```bash
git add next/src/views/HomePage.tsx next/src/views/EventsPage.tsx next/src/views/CalendarPage.tsx
git commit -m "feat(pull-refresh): soft refetch Accueil Events Calendar"
```

---

