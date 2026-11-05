# Admin parc abonnements — Implementation Plan

> **For agentic workers:** implement task-by-task; steps use checkbox syntax.

**Goal:** Afficher dans Admin → Abonnements le parc actifs + à risque (Lieu + Pro), filtrable/triable, avec raccourcis ouvrir / prolonger cadeau.

**Architecture:** Query admin dédiée dans `db-billing` + `GET /api/admin/billing/subscriptions` + panneau client `AdminSubscriptionsPanel` branché sur `AdminPage`.

**Tech Stack:** Next.js App Router, MariaDB (`mdl_mandala_billing_subscriptions`), `requireAdmin`.

## Global Constraints

- Vocabulaire UI Mandala (lieu, pas Prairie).
- Admin only ; pas de secrets Stripe dans la réponse.
- Réutiliser `grantPlaceComp` pour prolonger un cadeau.

---

### Task 1: Derive ops status + list query

**Files:**
- Modify: `next/src/lib/db-billing.ts`
- Create: `next/src/lib/admin-billing-ops-status.test.ts` (si vitest/jest déjà là)

- [x] Exporter `deriveAdminBillingOpsStatus` + `listAdminBillingSubscriptions`
- [x] Joindre user + community names

### Task 2: API route + client

**Files:**
- Create: `next/src/app/api/admin/billing/subscriptions/route.ts`
- Modify: `next/src/api/billing.ts`

- [x] GET avec `family`, `sort`, `order`
- [x] `billingApi.listAdminSubscriptions`

### Task 3: UI panneau + wiring

**Files:**
- Create: `next/src/components/billing/AdminSubscriptionsPanel.tsx`
- Modify: `next/src/views/AdminPage.tsx`
- Modify: `next/src/views/admin/AdminCommunitiesTab.tsx` (`initialSelectedId`)

- [x] Tableau + filtres/tri + raccourcis
- [x] Monter le panneau au-dessus de Cadeau / Endosser
