# Mandala — Monétisation (design)

> **Statut :** accepted · implémentation en cours  
> **Date :** 2026-11-01  
> **Repo :** `eludinart/workspace-mandala`  
> **Réf. technique :** Stripe Fleur (`c:\workspace` — checkout, webhook, catalogue) **sans** SAP / tirages / Mycelium

---

## 1. Intent

Rendre Mandala soutenable financièrement tout en gardant un **palier gratuit vraiment vivant** pour la vie de lieu.

**Promesse :**
> Mandala : le réseau vivant des lieux.  
> **Lieu** : ton lieu rayonne, tes membres sont couverts.  
> **Mandala Pro** : ta pratique devient trouvable et digne de confiance.

On monétise deux acteurs qui tirent une valeur économique claire :

1. **Lieux** — organisation, rayonnement, couverture des membres  
2. **Mandala Pro** — toute personne qui monétise une compétence (coaching, thérapie, artisanat, arts, services aux lieux, etc.)

On ne monétise **pas** l’appartenance relationnelle (messages, graines, participation aux événements).

---

## 2. Principes non négociables

1. **Le gratuit reste intéressant** : rejoindre un lieu, mur, événements (inscription), messagerie, graines, prairie, profil + compétences de base.
2. **Le lieu paie → les membres restent gratuits** sous la licence du lieu.
3. **Marque produit Pro = Mandala Pro** (multi-métiers, pas « thérapeutes only »).
4. **Pas de crédits type SAP** sur Mandala v1.
5. **Porte des fonctions** : billing derrière `MANDALA_BILLING_PUBLIC` (défaut `0`) ; admins app toujours OK.
6. **Serveur = source de vérité** : le client n’envoie jamais de `price_id` Stripe, seulement un `product_id` catalogue.
7. **Langage UI Mandala** : lieu, membre, compétence, **Mandala Pro** — pas le vocabulaire jardin/Fleur.

---

## 3. Personas & offres

### 3.1 Habitant (gratuit)

| Peut | Ne peut pas (v1) |
|------|------------------|
| Compte, lieux, charte, mur, annonces | Badge Mandala Pro |
| Événements (voir / s’inscrire) | Boost dans l’annuaire Compétences |
| Clairière, graines, prairie | Carte Mandala Pro + CTA contact pro |
| Lister compétences + ressources (tous registres dont `profession`) | Créer un lieu **listé publiquement** sans plan Lieu* |
| Voir (en teaser) ce que Lieu / Pro débloquent | Paywall sur le social |

\*Lieu **brouillon / privé** (`listed_public = 0`) OK sans abo ; catalogue public = plan Lieu actif, partner, ou admin.

### 3.2 Lieu (abonnement B2B sur la communauté)

Payeur : un **gestionnaire** (`organizer` / `admin` du lieu).  
Bénéficiaires : tous les **membres** du lieu.

Value irrésistible v1 :

- Lieu listé + **priorité catalogue / carte** (`billing_featured`)
- Compteur visible **« N membres couverts en gratuité »**
- Page lieu soignée (profil existant packagé comme bénéfice)
- Lien / partage lieu (kit diffusion léger)
- Early partners (Shambhala, Sivanà, …) : `billing_partner` sans Stripe

Copy CTA : *« Fais entrer ton lieu dans le Mandala public — tes membres restent gratuits. »*

### 3.3 Mandala Pro (abonnement B2C)

Payeur : l’utilisateur (multi-lieux, multi-métiers).

Value irrésistible v1 :

- **Carte Mandala Pro** (accroche, modalités, zone, lien, lieux d’attache)
- Boost + filtre **« Mandala Pro »** dans Compétences
- Badge **Mandala Pro** après vérification
- CTA **Contacter** (lead → notification / message prérempli)
- Tags métier via `profession` (artisan, coach, cuistot, photographe, …)

Copy CTA : *« Passe de “j’ai des compétences” à “on me trouve pour travailler”. »*

---

## 4. Tarification (validée)

| `product_id` | Mode | Plan | Prix |
|---|---|---|---|
| `place_monthly` | subscription | `place` | **29 € / mois** |
| `place_yearly` | subscription | `place` | **290 € / an** |
| `pro_monthly` | subscription | `pro` | **12 € / mois** |
| `pro_yearly` | subscription | `pro` | **120 € / an** |

`price_id` Stripe uniquement en variables d’env. Packs / billetterie / Connect : hors v1.

---

## 5. Modèle d’accès (entitlements)

### 5.1 Entités

```
User ──┬── mdl_billing_customers (stripe_customer_id)
       ├── mdl_billing_subscriptions (plan=pro|place, status, …)
       └── (si place) community_id NOT NULL

Community ── plan lieu actif si sub status ∈ {active, trialing}
             OR billing_partner = 1
             OR admin bypass
```

### 5.2 Résolution

- `resolvePlaceBilling(communityId): PlaceBilling`
- `resolveProBilling(userId): ProBilling`
- `userHasPlaceCoveredFree(userId): boolean`

```ts
type SubStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

type PlaceBilling = {
  status: SubStatus
  planId: 'place_monthly' | 'place_yearly' | 'partner' | null
  currentPeriodEnd: string | null
  coveredMemberCount: number
  featured: boolean
}

type ProBilling = {
  status: SubStatus
  planId: 'pro_monthly' | 'pro_yearly' | null
  verification: 'none' | 'pending' | 'verified' | 'rejected'
  currentPeriodEnd: string | null
}
```

### 5.3 Matrice features v1

| Feature key | Habitant | Membre lieu payant | Plan Lieu | Mandala Pro |
|---|---|---|---|---|
| `social_core` | ✅ | ✅ | ✅ | ✅ |
| `skills_basic` | ✅ | ✅ | ✅ | ✅ |
| `place_listed_public` | — | — | ✅ | — |
| `place_catalog_boost` | — | — | ✅ | — |
| `place_member_cover` | — | bénéficie | ✅ | — |
| `pro_badge` | — | — | — | si verified |
| `pro_skills_boost` | — | — | — | ✅ abo actif |
| `pro_contact_cta` | — | — | — | ✅ abo actif |
| `billing_cta` | porte ouverte ou admin | idem | idem | idem |

Règle : abo Mandala Pro actif → boost + CTA ; **badge** seulement si `verified`.

---

## 6. Vérification Mandala Pro (v1) — endossement lieux

Flux :

1. User (idéalement avec abo Pro, ou candidat) soumet : tagline + modalités + tags `profession`.
2. Statut `pending`.
3. **Peut approuver / rejeter :**
   - **Admin app** (toujours), **ou**
   - **Gestionnaire** (`organizer` / `admin`) d’un **lieu dont le candidat est membre**.
4. Approve → `verified` ; reject → `rejected` + motif court.
5. Enregistrement : `reviewer_id` + `endorsement_community_id` (null si admin plateforme).

Pas de KYC documentaire.  
Abo sans verify = boost sans badge.

Table optionnelle `mdl_pro_endorsements` (historique) si plusieurs endossements ; v1 peut se contenter des colonnes sur `mandala_pro_profiles`.

---

## 7. Architecture technique

### 7.1 Portage Fleur (sans SAP)

| Fleur | Mandala |
|---|---|
| `stripe.ts` / signature webhook / idempotence | Portés, tables `mdl_*` |
| `billing-catalog` + products JSON | place + pro only |
| SAP / seats_b2b | **Non portés** |

### 7.2 Schéma (`docs/schema/017_mandala_billing.sql`)

- `mandala_billing_customers`
- `mandala_billing_subscriptions`
- `mandala_communities.billing_partner`, `billing_featured`
- `mandala_pro_profiles` (+ `endorsement_community_id`)
- `mandala_stripe_webhook_events`

Une sub `place` active max par `community_id` ; une `pro` active max par `user_id`.

### 7.3 API

| Route | Rôle |
|---|---|
| `GET /api/billing/products` | Catalogue (labels, prix, pas de secrets) |
| `POST /api/billing/create-checkout-session` | `{ product_id, community_id? }` |
| `POST /api/billing/stripe-webhook` | Sync subs |
| `GET /api/billing/access` | pro + places + member_covered |
| `POST /api/billing/pro/submit` | Demande verify |
| `POST /api/billing/pro/[userId]/review` | approve/reject — **admin OU gestionnaire du lieu du candidat** |
| `GET /api/billing/pro/pending` | File pour admin + gestionnaires (filtrée aux membres de leurs lieux) |
| `POST /api/admin/billing/place/[communityId]/partner` | partner (admin app) |

Webhook : `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.payment_failed`.

### 7.4 UI (banger)

- **Écran offres** in-app (2 colonnes Lieu | Mandala Pro) — prix + 3 bullets + CTA
- **Compte** : statut Mandala Pro + checkout + soumission verify
- **Réglages lieu** : Offre Lieu, compteur membres couverts, checkout
- **Compétences** : filtre Mandala Pro, tri boost, badge, Contacter
- **Gestionnaire** : file « à endosser » (membres pending de ses lieux)
- **Admin** : file globale + toggle partner
- Porte fermée ⇒ CTAs invisibles hors admin

---

## 8. Hors scope v1

- Stripe Connect / billetterie / marketplace commission  
- Sièges gestionnaires payants à l’unité  
- SAP / IA  
- Abo membre individuel  
- Remise croisée Fleur (idée plus tard)

---

## 9. Risques

| Risque | Mitigation |
|---|---|
| Paywall social | Matrice stricte ; teasers non bloquants |
| Lieux historiques | `billing_partner` |
| Badge copinage lieux | Motif + reviewer tracé ; admin peut révoquer |
| Confusion Lieu vs Pro | Copy + écran offres dédié |

---

## 10. Critères de succès v1

1. Checkout Lieu test → listing / featured OK ; membres sans paywall.  
2. Checkout Mandala Pro → boost ; badge après endossement admin **ou** gestionnaire.  
3. Habitant : parcours social inchangé.  
4. Porte `0` : pas de CTA pour non-admins.  
5. Écran offres + compteur « membres couverts » visibles quand porte ouverte.

---

## 11. Décisions verrouillées

- Tarifs validés (§4).  
- Nom produit : **Mandala Pro**.  
- Endossement : **admin app + gestionnaires de lieu** (candidat membre du lieu).  
- Gratuit = vie relationnelle intacte.  
- Stripe façon Fleur, pas de SAP.
