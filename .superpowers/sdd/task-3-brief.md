### Task 3: Brancher Layout

**Files:**
- Modify: `next/src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: `PullToRefresh`, `page: MandalaPage`
- Produces: scroll principal wrappé (sauf `page === 'messages'`)

- [ ] **Step 1: Wrap `<main>` content**

Replace the non-messages `<main>` so the scroll lives on `PullToRefresh`:

Before: `main` has `overflow-auto` and `{children}`.

After:

```tsx
<main
  className={`flex-1 min-h-0 min-w-0 w-full flex flex-col ${
    page === 'home' ? 'p-0' : 'p-0'
  }`}
>
  <PullToRefresh
    page={page}
    className={`flex-1 overflow-auto ${page === 'home' ? 'p-0' : 'p-4 md:p-6'}`}
  >
    {children}
  </PullToRefresh>
</main>
```

Keep Messages branch unchanged (no `PullToRefresh` here).

Import: `import { PullToRefresh } from '@/components/PullToRefresh'`

- [ ] **Step 2: Smoke mental check**

- Pages hard sans handler → pull déclenche `runPullRefresh` → `'hard'` → reload
- Pages soft sans handler encore → aussi hard jusqu’à Task 4–6 (fallback spec OK temporairement)

- [ ] **Step 3: Commit**

```bash
git add next/src/components/layout/Layout.tsx
git commit -m "feat(pull-refresh): brancher PullToRefresh sur le Layout"
```

---

