# Monetisation Mandala MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher Stripe (pattern Fleur) sur Mandala avec deux abonnements — **Lieu** et **Mandala Pro** — sans paywall social, derrière une porte feature, avec UX irrésistible (écran offres, boost, badge, endossement lieux).

**Architecture:** Catalogue serveur → Checkout Stripe → webhook idempotent → tables `mdl_billing_*` → `resolvePlaceBilling` / `resolveProBilling` → gates UI/API. Pas de SAP. Spec : `docs/superpowers/specs/2026-11-01-monetisation-design.md`.

**Tech Stack:** Next.js 15 API routes, MariaDB (`mdl_`), Stripe REST (sans SDK, comme Fleur), TypeScript, `node:test` + `tsx` pour tests unitaires des entitlements purs.

## Décisions produit (verrouillées)

- Tarifs : Lieu **29 €/mois** · **290 €/an** ; Mandala Pro **12 €/mois** · **120 €/an**
- Nom : **Mandala Pro** (marque unique)
- Endossement badge : **admin app OU gestionnaire** d’un lieu dont le candidat est membre
- Banger v1 : écran offres 2 colonnes, compteur membres couverts, carte Pro, filtre/boost/badge, CTA Contacter

## Global Constraints

- Préfixe tables : `mdl_` (`DB_PREFIX`)
- Client : seulement `product_id` (jamais `price_id`)
- Feature door : `MANDALA_BILLING_PUBLIC` défaut `0` ; admins app toujours OK
- Langage UI : lieu / membre / compétence / **Mandala Pro**
- Ne pas importer SAP, tirages, Mycelium seats
- Commits petits et fréquents ; ne pas committer secrets Stripe

---

## File map

| Path | Responsibility |
|------|----------------|
| `docs/schema/017_mandala_billing.sql` | DDL billing + pro profiles + colonnes community |
| `next/src/data/billing-products.json` | Catalogue place/pro |
| `next/src/lib/billing-catalog.ts` | Resolve product_id → price env |
| `next/src/lib/stripe.ts` | Checkout + helpers Stripe |
| `next/src/lib/stripe-webhook.ts` | Vérif signature |
| `next/src/lib/db-stripe-webhook.ts` | Idempotence events |
| `next/src/lib/db-billing.ts` | CRUD subscriptions / customers / partner |
| `next/src/lib/billing-entitlements.ts` | Matrice features pure |
| `next/src/lib/billing-access.ts` | resolvePlace / resolvePro / memberCovered |
| `next/src/lib/billing-door.ts` | Porte `MANDALA_BILLING_PUBLIC` + admin |
| `next/src/app/api/billing/**` | products, checkout, webhook, access, pro/submit |
| `next/src/app/api/admin/billing/**` | review pro, partner lieu |
| `next/src/api/billing.ts` | Client fetch typé |
| `next/src/views/AccountPage.tsx` | Section Pro |
| `next/src/views/PlaceSettings*` / settings lieu | Section Offre Lieu |
| `next/src/components/skills/SkillsDirectory.tsx` | Boost + badge + filtre |
| `next/.env.example` | Vars Stripe documentées |
| `next/src/lib/billing-entitlements.test.ts` | Tests matrice |

---

### Task 1: Entitlements purs + tests

**Files:**
- Create: `next/src/lib/billing-entitlements.ts`
- Create: `next/src/lib/billing-entitlements.test.ts`
- Modify: `next/package.json` (scripts `test:billing`)

**Interfaces:**
- Produces: `FeatureKey`, `canAccessFeature(flags, key)`, `sortSkillsBoost(a, b)`

- [ ] **Step 1: Ajouter la dépendance de test et le script**

Dans `next/package.json`, ajouter devDependency `tsx` et script :

```json
"test:billing": "tsx --test src/lib/billing-entitlements.test.ts"
```

Install : `cd next && npm install -D tsx`

- [ ] **Step 2: Écrire le test qui échoue**

```ts
// next/src/lib/billing-entitlements.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canAccessFeature,
  type EntitlementFlags,
} from './billing-entitlements'

const base: EntitlementFlags = {
  isAppAdmin: false,
  billingPublic: true,
  placeActive: false,
  proActive: false,
  proVerified: false,
  memberCovered: false,
}

describe('canAccessFeature', () => {
  it('allows social_core for everyone', () => {
    assert.equal(canAccessFeature(base, 'social_core'), true)
  })

  it('denies place_listed_public without place plan', () => {
    assert.equal(canAccessFeature(base, 'place_listed_public'), false)
  })

  it('allows place_listed_public with place plan', () => {
    assert.equal(
      canAccessFeature({ ...base, placeActive: true }, 'place_listed_public'),
      true
    )
  })

  it('allows pro_skills_boost only when proActive', () => {
    assert.equal(canAccessFeature(base, 'pro_skills_boost'), false)
    assert.equal(
      canAccessFeature({ ...base, proActive: true }, 'pro_skills_boost'),
      true
    )
  })

  it('allows pro_badge only when proActive and proVerified', () => {
    assert.equal(
      canAccessFeature({ ...base, proActive: true }, 'pro_badge'),
      false
    )
    assert.equal(
      canAccessFeature(
        { ...base, proActive: true, proVerified: true },
        'pro_badge'
      ),
      true
    )
  })

  it('hides paid CTAs when billing door closed unless admin', () => {
    assert.equal(
      canAccessFeature(
        { ...base, billingPublic: false, placeActive: true },
        'billing_cta'
      ),
      false
    )
    assert.equal(
      canAccessFeature(
        { ...base, billingPublic: false, isAppAdmin: true },
        'billing_cta'
      ),
      true
    )
  })
})
```

- [ ] **Step 3: Run test — expect FAIL (module missing)**

Run: `cd next && npm run test:billing`  
Expected: Cannot find module `./billing-entitlements`

- [ ] **Step 4: Implémenter le module**

```ts
// next/src/lib/billing-entitlements.ts
export type FeatureKey =
  | 'social_core'
  | 'skills_basic'
  | 'place_listed_public'
  | 'place_catalog_boost'
  | 'place_member_cover'
  | 'pro_badge'
  | 'pro_skills_boost'
  | 'pro_contact_cta'
  | 'billing_cta'

export type EntitlementFlags = {
  isAppAdmin: boolean
  billingPublic: boolean
  placeActive: boolean
  proActive: boolean
  proVerified: boolean
  memberCovered: boolean
}

export function canAccessFeature(
  flags: EntitlementFlags,
  key: FeatureKey
): boolean {
  switch (key) {
    case 'social_core':
    case 'skills_basic':
      return true
    case 'billing_cta':
      return flags.billingPublic || flags.isAppAdmin
    case 'place_listed_public':
    case 'place_catalog_boost':
    case 'place_member_cover':
      return flags.placeActive
    case 'pro_skills_boost':
    case 'pro_contact_cta':
      return flags.proActive
    case 'pro_badge':
      return flags.proActive && flags.proVerified
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

/** Tri décroissant : boost Pro d’abord, puis label. */
export function compareSkillBoost(
  a: { proBoost: boolean; label: string },
  b: { proBoost: boolean; label: string }
): number {
  if (a.proBoost !== b.proBoost) return a.proBoost ? -1 : 1
  return a.label.localeCompare(b.label, 'fr')
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd next && npm run test:billing`  
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add next/package.json next/package-lock.json next/src/lib/billing-entitlements.ts next/src/lib/billing-entitlements.test.ts
git commit -m "feat(billing): entitlements matrix and unit tests"
```

---

### Task 2: Schéma SQL billing

**Files:**
- Create: `docs/schema/017_mandala_billing.sql`
- Modify: `scripts/apply-all-schemas.mjs` seulement si la liste des fichiers est explicite (sinon le glob `*.sql` suffit)

**Interfaces:**
- Produces: tables `mandala_billing_customers`, `mandala_billing_subscriptions`, `mandala_pro_profiles`, `mandala_stripe_webhook_events` ; colonnes community `billing_partner`, `billing_featured`

- [ ] **Step 1: Écrire la migration**

```sql
-- docs/schema/017_mandala_billing.sql
-- Billing Mandala : customers, subscriptions, pro profiles, webhook idempotence

ALTER TABLE mdl_mandala_communities
  ADD COLUMN IF NOT EXISTS billing_partner TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_featured TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mdl_mandala_billing_customers (
  user_id INT NOT NULL PRIMARY KEY,
  stripe_customer_id VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stripe_customer (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_billing_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  community_id INT NULL DEFAULT NULL,
  plan_family ENUM('place','pro') NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'none',
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_price_id VARCHAR(255) NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stripe_sub (stripe_subscription_id),
  KEY idx_user_family (user_id, plan_family),
  KEY idx_community (community_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_pro_profiles (
  user_id INT NOT NULL PRIMARY KEY,
  verification ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  tagline VARCHAR(200) NULL,
  modalities TEXT NULL,
  service_area VARCHAR(200) NULL,
  external_url VARCHAR(500) NULL,
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,
  reviewer_id INT NULL,
  endorsement_community_id INT NULL,
  reject_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_stripe_webhook_events (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Note : si `ADD COLUMN IF NOT EXISTS` multi-colonnes pose problème sur MariaDB cible, splitter en deux `ALTER`.

- [ ] **Step 2: Appliquer en local (tunnel VPS)**

Run: `node scripts/apply-all-schemas.mjs` (depuis racine repo, avec env DB Mandala)  
Expected: pas d’erreur fatale ; tables présentes

- [ ] **Step 3: Commit**

```bash
git add docs/schema/017_mandala_billing.sql
git commit -m "feat(billing): add MariaDB schema for subscriptions and pro profiles"
```

---

### Task 3: Catalogue + client Stripe (port Fleur sans SAP)

**Files:**
- Create: `next/src/data/billing-products.json`
- Create: `next/src/lib/billing-catalog.ts`
- Create: `next/src/lib/stripe.ts`
- Create: `next/src/lib/stripe-webhook.ts`
- Modify: `next/.env.example` (ou `docker-compose.env.example`)

**Interfaces:**
- Produces: `resolveBillingProduct(productId)`, `createCheckoutSession(...)`, `getStripeSecretKey()`, `verifyStripeWebhookSignature(...)`
- Consumes: env `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLACE_MONTHLY`, `STRIPE_PRICE_PLACE_YEARLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_WEBHOOK_SECRET`

- [ ] **Step 1: Catalogue JSON**

```json
{
  "subscriptions": {
    "place_monthly": {
      "price_id_env": "STRIPE_PRICE_PLACE_MONTHLY",
      "plan_id": "place_monthly",
      "plan_family": "place",
      "label": "Lieu — mensuel",
      "amount_cents": 2900,
      "unit": "mois"
    },
    "place_yearly": {
      "price_id_env": "STRIPE_PRICE_PLACE_YEARLY",
      "plan_id": "place_yearly",
      "plan_family": "place",
      "label": "Lieu — annuel",
      "amount_cents": 29000,
      "unit": "an"
    },
    "pro_monthly": {
      "price_id_env": "STRIPE_PRICE_PRO_MONTHLY",
      "plan_id": "pro_monthly",
      "plan_family": "pro",
      "label": "Mandala Pro — mensuel",
      "amount_cents": 1200,
      "unit": "mois"
    },
    "pro_yearly": {
      "price_id_env": "STRIPE_PRICE_PRO_YEARLY",
      "plan_id": "pro_yearly",
      "plan_family": "pro",
      "label": "Mandala Pro — annuel",
      "amount_cents": 12000,
      "unit": "an"
    }
  }
}
```

- [ ] **Step 2: `billing-catalog.ts`**

Porter la logique de `c:\workspace\next\src\lib\billing-catalog.ts` :
- `envPrice(envName)` lit `process.env`
- `resolveBillingProduct(id)` → `{ productId, priceId, mode: 'subscription', planId, planFamily }`
- `listBillingProducts()` pour l’API publique (sans price_id)
- `safeReturnUrl(base, candidate, fallback)` anti open-redirect

Inclure `planFamily: 'place' | 'pro'` dans le type retourné.

- [ ] **Step 3: Copier/adapter `stripe.ts` et `stripe-webhook.ts` depuis Fleur**

Depuis `c:\workspace\next\src\lib/stripe.ts` et `stripe-webhook.ts` :
- Garder `createCheckoutSession`, `getStripeSecretKey`, `verifyStripeWebhookSignature`
- Metadata checkout : `user_id`, `plan_id`, `plan_family`, et `community_id` si place
- Ne pas ajouter de champs SAP

- [ ] **Step 4: Documenter les env**

Ajouter dans l’exemple d’env :

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PLACE_MONTHLY=
STRIPE_PRICE_PLACE_YEARLY=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
MANDALA_BILLING_PUBLIC=0
```

- [ ] **Step 5: Typecheck**

Run: `cd next && npm run typecheck`  
Expected: OK

- [ ] **Step 6: Commit**

```bash
git add next/src/data/billing-products.json next/src/lib/billing-catalog.ts next/src/lib/stripe.ts next/src/lib/stripe-webhook.ts
git commit -m "feat(billing): Stripe catalog and checkout helpers"
```

---

### Task 4: Couche DB billing + résolution d’accès

**Files:**
- Create: `next/src/lib/db-stripe-webhook.ts`
- Create: `next/src/lib/db-billing.ts`
- Create: `next/src/lib/billing-door.ts`
- Create: `next/src/lib/billing-access.ts`

**Interfaces:**
- Consumes: tables Task 2 ; `canAccessFeature` Task 1
- Produces:
  - `claimStripeWebhookEvent` / `releaseStripeWebhookEvent`
  - `upsertSubscriptionFromStripe(...)`
  - `setCommunityPartner(communityId, on)`
  - `resolvePlaceBilling(communityId)`
  - `resolveProBilling(userId)`
  - `userHasPlaceCoveredFree(userId)`
  - `isBillingPublic()`, `assertBillingDoor(userId)` 

- [ ] **Step 1: Idempotence webhook**

Adapter Fleur `db-stripe-webhook.ts` → table `mandala_stripe_webhook_events`.

- [ ] **Step 2: `db-billing.ts` — écritures**

Fonctions minimales :

```ts
export async function upsertCustomer(userId: number, stripeCustomerId: string): Promise<void>
export async function upsertSubscription(row: {
  userId: number
  communityId: number | null
  planFamily: 'place' | 'pro'
  planId: string
  status: string
  stripeSubscriptionId: string
  stripePriceId: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}): Promise<void>
export async function markSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  currentPeriodEnd: Date | null,
  cancelAtPeriodEnd: boolean
): Promise<void>
export async function getActivePlaceSubscription(communityId: number): Promise<SubRow | null>
export async function getActiveProSubscription(userId: number): Promise<SubRow | null>
export async function setBillingPartner(communityId: number, on: boolean): Promise<void>
export async function getProProfile(userId: number): Promise<ProProfileRow | null>
export async function upsertProProfileSubmit(userId: number, fields: {...}): Promise<void>
export async function reviewProProfile(
  userId: number,
  decision: 'verified' | 'rejected',
  reviewerId: number,
  reason?: string
): Promise<void>
```

Statuts « actifs » pour entitlements : `active`, `trialing`.

- [ ] **Step 3: `billing-door.ts`**

```ts
export function isBillingPublic(): boolean {
  return (process.env.MANDALA_BILLING_PUBLIC || '0').trim() === '1'
}
```

`assertBillingCtaAllowed(isAppAdmin)` throw 404/403 si porte fermée et non admin.

- [ ] **Step 4: `billing-access.ts`**

```ts
export async function resolvePlaceBilling(communityId: number): Promise<PlaceBilling>
export async function resolveProBilling(userId: number): Promise<ProBilling>
export async function userHasPlaceCoveredFree(userId: number): Promise<boolean>
export async function buildEntitlementFlags(opts: {
  userId: number
  communityId?: number
  isAppAdmin: boolean
}): Promise<EntitlementFlags>
```

`PlaceBilling.featured` = partner OR (sub active) — aligné spec §5.

- [ ] **Step 5: Typecheck**

Run: `cd next && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add next/src/lib/db-stripe-webhook.ts next/src/lib/db-billing.ts next/src/lib/billing-door.ts next/src/lib/billing-access.ts
git commit -m "feat(billing): persistence and access resolution"
```

---

### Task 5: Routes API billing + webhook

**Files:**
- Create: `next/src/app/api/billing/products/route.ts`
- Create: `next/src/app/api/billing/create-checkout-session/route.ts`
- Create: `next/src/app/api/billing/stripe-webhook/route.ts`
- Create: `next/src/app/api/billing/access/route.ts`
- Create: `next/src/app/api/billing/pro/submit/route.ts`
- Create: `next/src/app/api/billing/pro/pending/route.ts`
- Create: `next/src/app/api/billing/pro/[userId]/review/route.ts` (admin **ou** gestionnaire du lieu du candidat)
- Create: `next/src/app/api/admin/billing/place/[communityId]/partner/route.ts`
- Create: `next/src/api/billing.ts`

**Interfaces:**
- Consumes: catalog, stripe, db-billing, billing-access, `canManageCommunity` existant
- Produces: endpoints spec §7.3

- [ ] **Step 1: `GET /api/billing/products`**

Retourne labels + amounts du JSON (pas de price_id). Auth optionnelle.

- [ ] **Step 2: `POST /api/billing/create-checkout-session`**

Body : `{ product_id, community_id?, success_url?, cancel_url? }`  
Règles :
- Auth required
- Porte billing ouverte OU admin
- Si `planFamily === 'place'` : `community_id` requis + `canManageCommunity(user, community)`
- Metadata Stripe : `user_id`, `plan_id`, `plan_family`, `community_id`
- Success/cancel ancrés via `safeReturnUrl` sur `NEXT_PUBLIC_APP_URL`

S’inspirer de `c:\workspace\next\src\app\api\billing\create-checkout-session\route.ts`.

- [ ] **Step 3: Webhook**

Traiter :
1. `checkout.session.completed` → upsert customer + subscription (retrieve sub si besoin via Stripe GET `/subscriptions/{id}`)
2. `customer.subscription.updated` / `deleted` → `markSubscriptionStatus`
3. `invoice.payment_failed` → status `past_due`

Toujours `claim` / `release` idempotence. Répondre 200 si déjà vu.

- [ ] **Step 4: `GET /api/billing/access`**

Auth. Retourne :

```json
{
  "billing_public": false,
  "member_covered": true,
  "pro": { "status": "none", "verification": "none", "plan_id": null, "current_period_end": null },
  "places": [{ "community_id": 1, "status": "active", "plan_id": "place_monthly", "featured": true }]
}
```

Pour chaque communauté gérée par l’user + optionnellement lieux dont il est membre (cover).

- [ ] **Step 5: Pro submit + admin review + partner**

- `POST /api/billing/pro/submit` — body tagline/modalities/… → verification `pending`  
- Admin review — require app admin  
- Partner toggle — require app admin  

- [ ] **Step 6: Client `api/billing.ts`**

Méthodes : `listProducts`, `createCheckoutSession`, `getAccess`, `submitPro`, (admin helpers si besoin).

- [ ] **Step 7: Typecheck + smoke manuel**

Run: `cd next && npm run typecheck`  
Smoke (avec Stripe test keys en local) :  
`POST /api/billing/create-checkout-session` avec `product_id=pro_monthly` → URL `checkout.stripe.com`

- [ ] **Step 8: Commit**

```bash
git add next/src/app/api/billing next/src/app/api/admin/billing next/src/api/billing.ts
git commit -m "feat(billing): API checkout, webhook, access and pro review"
```

---

### Task 6: Gate serveur `listed_public` + featured

**Files:**
- Modify: `next/src/lib/db-communities.ts` (create / update listed_public)
- Modify: routes place settings qui acceptent `listed_public`

**Interfaces:**
- Consumes: `resolvePlaceBilling`, `canAccessFeature`
- Produces: refus 403 si `listed_public=1` sans plan/partner (sauf admin)

- [ ] **Step 1: Helper**

```ts
export async function assertCanListPlacePublic(
  communityId: number,
  isAppAdmin: boolean
): Promise<void> {
  const billing = await resolvePlaceBilling(communityId)
  const flags: EntitlementFlags = {
    isAppAdmin,
    billingPublic: isBillingPublic(),
    placeActive: billing.status === 'active' || billing.status === 'trialing' || billing.planId === 'partner',
    proActive: false,
    proVerified: false,
    memberCovered: false,
  }
  if (!canAccessFeature(flags, 'place_listed_public') && !isAppAdmin) {
    throw Object.assign(
      new Error('L’offre Lieu est requise pour publier ce lieu au catalogue'),
      { status: 403 }
    )
  }
}
```

- [ ] **Step 2: Brancher sur update community quand `listed_public` passe à true**

Si passage à `1` → `assertCanListPlacePublic`.  
Si abo expire plus tard : ne pas auto-délister en v1 (grace) — documenter ; optionnel job phase 2.

- [ ] **Step 3: Catalogue / boost**

Dans la requête catalogue (là où `listed_public` filtre), `ORDER BY billing_featured DESC, billing_partner DESC, name` ou score dérivé de `resolvePlaceBilling`.

Mettre à jour `billing_featured` au webhook quand place devient active (et clear si deleted) — dans `upsertSubscription` côté place.

- [ ] **Step 4: Typecheck + test manuel**

Créer lieu sans abo → `listed_public=1` → 403.  
Partner admin → OK.

- [ ] **Step 5: Commit**

```bash
git add next/src/lib/db-communities.ts next/src/lib/billing-access.ts
git commit -m "feat(billing): gate public place listing behind Lieu plan"
```

---

### Task 7: UI banger — Offres + Compte (Mandala Pro) + Réglages lieu

**Files:**
- Create: `next/src/views/BillingOffersPage.tsx` (2 colonnes Lieu | Mandala Pro)
- Modify: `next/src/components/MandalaApp.tsx` (route `billing-offers`)
- Modify: `next/src/views/AccountPage.tsx`
- Modify: page réglages lieu (`PlaceSettingsPage` / `place-profile`)
- Create: `next/src/components/billing/CheckoutButtons.tsx`, `ProStatusCard.tsx`, `PlacePlanCard.tsx`

**Interfaces:**
- Consumes: `billingApi.getAccess`, `createCheckoutSession`, `submitPro`
- Produces: CTAs visibles seulement si `canAccessFeature(..., 'billing_cta')`

- [ ] **Step 1: Écran offres**

Page dédiée : promesse + 2 colonnes (prix validés, 3 bullets, CTA). Entrée depuis Compte et réglages lieu.

- [ ] **Step 2: Section Compte « Mandala Pro »**

- Statut abo + date de fin  
- Boutons mensuel / annuel → checkout  
- Formulaire soumission vérification  
- Badge preview si verified  

Porte fermée + non admin → section absente.

- [ ] **Step 3: Section Lieu « Offre Lieu »**

- Statut plan / partner  
- **Compteur « N membres couverts en gratuité »**  
- CTA checkout + copy *« … tes membres restent gratuits »*  
- Lien partage lieu (kit léger)

- [ ] **Step 4: Smoke UI**

`MANDALA_BILLING_PUBLIC=0` + admin → visible ; membre non-admin → absente.

- [ ] **Step 5: Commit**

```bash
git add next/src/views/BillingOffersPage.tsx next/src/views/AccountPage.tsx next/src/components/billing next/src/components/MandalaApp.tsx
git commit -m "feat(billing): offers screen, Mandala Pro and place checkout UI"
```

---

### Task 8: Compétences — boost, filtre, badge

**Files:**
- Modify: `next/src/components/skills/SkillsDirectory.tsx`
- Modify: `next/src/lib/db-skills.ts` (joindre pro boost / verification si besoin)
- Modify: cartes profil compétences si séparées

**Interfaces:**
- Consumes: `compareSkillBoost`, `resolveProBilling` (batch préférable)
- Produces: tri boosté ; badge « Profil métier » ; filtre optionnel

- [ ] **Step 1: Enrichir la liste directory**

Pour chaque user retourné, flags `pro_boost` (abo actif) et `pro_verified`.  
Éviter N+1 : une requête `IN (...)` sur subscriptions pro actives + pro_profiles.

- [ ] **Step 2: UI**

- Tri via `compareSkillBoost`  
- Pastille badge seulement si verified  
- Filtre « Profils métier » = `pro_boost || pro_verified`

- [ ] **Step 3: CTA contact (minimal)**

Si `pro_contact_cta` : bouton « Contacter » → ouvre graine / message existant avec texte prérempli (réutiliser flux social actuel, pas de nouveau chat stack).

- [ ] **Step 4: Typecheck + smoke directory**

- [ ] **Step 5: Commit**

```bash
git add next/src/components/skills/SkillsDirectory.tsx next/src/lib/db-skills.ts
git commit -m "feat(billing): boost and badge verified pros in skills directory"
```

---

### Task 9: Endossement — file gestionnaires + admin partner

**Files:**
- Modify: hub lieu / réglages gestionnaire (file « À endosser »)
- Modify: `next/src/views/AdminPage.tsx`
- Create: `next/src/components/admin/AdminBillingTab.tsx`
- Create: `next/src/components/billing/ProEndorseQueue.tsx`

**Interfaces:**
- Consumes: `GET /api/billing/pro/pending`, `POST /api/billing/pro/[userId]/review`, partner admin API
- Produces: gestionnaire voit uniquement les pending **membres de ses lieux** ; admin voit tout + toggle partner

- [ ] **Step 1: Autorisation review**

`canReviewPro(reviewerId, subjectUserId)` :
- app admin → true, `endorsement_community_id = null`
- sinon : existe community où reviewer est organizer/admin **et** subject est membre → true, stocker ce `community_id`

- [ ] **Step 2: UI file gestionnaire + admin**

Approve / reject + motif. Partner lieux = admin only.

- [ ] **Step 3: Smoke**

Soumettre Pro → visible gestionnaire du lieu du candidat → approve → badge.  
Admin peut aussi approve et toggler partner.

- [ ] **Step 4: Commit**

```bash
git add next/src/components/billing/ProEndorseQueue.tsx next/src/views/AdminPage.tsx next/src/components/admin/AdminBillingTab.tsx next/src/app/api/billing/pro
git commit -m "feat(billing): place-manager endorsement queue and admin partner flags"
```

---

### Task 10: Doc ops + case Suite + smoke prod-ready

**Files:**
- Modify: `docs/GUIDE-DEV-ET-DEPLOI.md` (section Stripe courte)
- Modify: `docs/SUITE.md` (case monétisation / suivi)
- Modify: `docs/superpowers/specs/2026-11-01-monetisation-design.md` statut → `accepted` si Eric valide

- [ ] **Step 1: Doc Coolify**

Documenter :
- Variables env Stripe (mode test puis live)
- Endpoint webhook `https://mandala.eludein.art/api/billing/stripe-webhook`
- Events à cocher dans le Dashboard Stripe
- `MANDALA_BILLING_PUBLIC=0` jusqu’à ouverture

- [ ] **Step 2: Ajouter à la Suite**

Dans `docs/SUITE.md` section À faire (fin) :

```markdown
- [ ] **Monétisation Lieu / Pro.** Derrière porte billing. Spec `docs/superpowers/specs/2026-11-01-monetisation-design.md`, plan `docs/superpowers/plans/2026-11-01-monetisation-mvp.md`. Ne pas ouvrir la porte tant que le smoke Stripe test n’est pas vert.
```

- [ ] **Step 3: Checklist smoke finale**

1. `npm run test:billing` vert  
2. `npm run typecheck` vert  
3. Checkout Pro test → webhook → `GET /api/billing/access` pro active  
4. Checkout Lieu test → listed_public OK  
5. Membre du lieu : pas de paywall social  
6. Porte `0` : membre non-admin ne voit pas les CTAs  

- [ ] **Step 4: Commit docs**

```bash
git add docs/
git commit -m "docs(billing): ops notes and suite tracking for monetisation MVP"
```

---

## Self-review (auteur du plan)

| Spec § | Couvert par |
|--------|-------------|
| Gratuit social intact | Tasks 1, 6–8 (gates payantes seulement) |
| Plan Lieu + cover membres | Tasks 4–7 |
| Plan Pro multi-métiers | Tasks 5, 7–9 |
| Stripe façon Fleur sans SAP | Tasks 3, 5 |
| Feature door | Tasks 1, 4, 7 |
| Vérification badge | Tasks 5, 8, 9 |
| Hors scope Connect/billets | Non planifié (OK) |

Pas de TBD dans les steps. Types `EntitlementFlags` / `FeatureKey` alignés Tasks 1→8.

---

## Après ce plan

Phase 2 (nouveau plan, plus tard) : Customer Portal Stripe, auto-déliste à l’expiration, sièges gestionnaires, Connect/billetterie, remise Fleur.
