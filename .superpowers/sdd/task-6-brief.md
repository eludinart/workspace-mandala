### Task 6: Messages (liste + fil)

**Files:**
- Modify: `next/src/views/MessagesPage.tsx`
- Modify: `next/src/components/social/DialogueStream.tsx`

**Interfaces:**
- Consumes: `PullToRefresh`, `useRegisterPullRefresh`, `loadChannels`, `loadChannelMessages`

- [ ] **Step 1: Wrap Messages scroll areas**

Messages Layout has no shared `<main>` scroll. Wrap:

1. Liste : the `div` with `overflow-y-auto` around channels (~line 497) → replace with `<PullToRefresh page="messages" className="flex-1 min-h-0 overflow-y-auto">…</PullToRefresh>`
2. Fil : wrap the messages scroll inside `DialogueStream` (the overflow-y container of the thread) with `<PullToRefresh page="messages" …>` **or** register handler only and rely on one outer wrapper when chat is open.

Prefer **one** `PullToRefresh` visible at a time:

- When `!chatOpen` (mobile list): wrap list scroll
- When chat open: wrap DialogueStream message list scroll

- [ ] **Step 2: Register soft handler in MessagesPage**

```ts
const onPull = useCallback(async () => {
  await loadChannels()
  const id = selectedIdRef.current
  if (id != null) {
    await useSocialStore.getState().loadChannelMessages(id)
  }
}, [loadChannels])
useRegisterPullRefresh('messages', onPull)
```

(Use the store’s `getState()` to avoid hook rules issues, or pass `loadChannelMessages` from a component that already uses the store.)

- [ ] **Step 3: DialogueStream — avoid blanking on pull**

Ensure `loadChannelMessages` does not clear messages before replace (store already merges/replaces — verify). If DialogueStream sets empty on load start, skip that on refresh.

- [ ] **Step 4: Commit**

```bash
git add next/src/views/MessagesPage.tsx next/src/components/social/DialogueStream.tsx
git commit -m "feat(pull-refresh): Messages liste et fil"
```

---

