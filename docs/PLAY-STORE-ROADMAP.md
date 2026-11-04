# Mandala — Feuille de route jusqu’à Google Play

> **Objectif :** même app web Coolify (`https://mandala.eludein.art`) utilisable sur **PC** et publiée sur **Google Play** (TWA), avec abonnements **Lieu** / **Mandala Pro** (Stripe sur le web, Play Billing in-app).  
> **Socle code déjà posé** (2026-11-01) : CGU/CGV/confidentialité, acceptation, signalement, blocage, dual checkout, SW offline, `assetlinks.json` placeholder.  
> **Spec** : `docs/superpowers/specs/2026-11-01-play-store-readiness-design.md`  
> **Suite** : cases liées dans `docs/SUITE.md`  
> **Anti-rejet** : `docs/PLAY-STORE-AVOID-REJECTION.md` · listing `docs/PLAY-STORE-LISTING.md`

Cocher au fur et à mesure. Ordre recommandé = dépendances.

---

## 0. Prérequis produit (déjà en grande partie fait)

- [x] Pages légales publiques `/cgu` `/cgv` `/confidentialite` (**prod 200** depuis 2026-11-01)
- [x] Acceptation CGU à l’inscription + gate comptes existants
- [x] Signalement UGC + admin Modération
- [x] Blocage utilisateur (messagerie 1:1)
- [x] Suppression de compte accessible
- [x] Dual rail paiement (Stripe web / Play acknowledge)
- [x] **Blocage Stripe en contexte Play** (`resolvePaymentSurface` → BillingOffers + portail Compte)
- [x] Offline SW + placeholder Digital Asset Links
- [ ] Relire et personnaliser les textes légaux (éditeur, adresse, e-mail, SIRET si besoin)
- [ ] Appliquer le schéma `docs/schema/021_mandala_play_readiness.sql` en prod (ou laisser le `ensure*` runtime après deploy)

---

## 1. Stripe (web / PC) — d’abord

Sans Stripe vert, ne pas ouvrir la porte billing au public.

- [x] Compte Stripe (même compte org que Fleur — **live** branché 2026-11-01)
- [x] Créer les 4 produits / prix :
  - Lieu mensuel **29 €** → `STRIPE_PRICE_PLACE_MONTHLY` (`price_1UX0Vz…`)
  - Lieu annuel **290 €** → `STRIPE_PRICE_PLACE_YEARLY` (`price_1UX0W0…` / CeJf…)
  - Mandala Pro mensuel **12 €** → `STRIPE_PRICE_PRO_MONTHLY`
  - Mandala Pro annuel **120 €** → `STRIPE_PRICE_PRO_YEARLY`
- [x] Clés Coolify Mandala : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, les 4 `STRIPE_PRICE_*` (+ `MANDALA_BILLING_PUBLIC=0`)
- [x] `NEXT_PUBLIC_APP_URL=https://mandala.eludein.art`
- [x] Webhook Stripe → `https://mandala.eludein.art/api/billing/stripe-webhook` (`we_1UX0W1…`)
- [x] Smoke catalogue prod : `/api/billing/products` → 4× `configured: true`, porte fermée
- [ ] Smoke checkout manuel admin (carte) + webhook reçu + entitlements en base
- [x] Portail / résiliation : Compte → « Gérer un abonnement Stripe » (`/api/billing/portal`) — code ; activer Customer Portal dans le Dashboard Stripe
- [ ] **Puis seulement** : ouvrir la porte monétisation (`MANDALA_BILLING_PUBLIC=1`) pour un public élargi

Réf. : `docs/STRIPE-SETUP-MANDALA.md` · script `scripts/stripe-setup-mandala.mjs` · monétisation `docs/superpowers/specs/2026-11-01-monetisation-design.md`

> **Note Coolify UI :** les variables ont été écrites dans le `.env` runtime + `/root/mandala-coolify-production.env`. Si tu resauves l’env depuis l’UI Coolify sans ces clés, elles peuvent disparaître — resynchroniser depuis le fichier `/root/…` si besoin.

---

## 2. Compte & enregistrement Google Play

- [x] Compte Google Play Console (frais unique développeur) — **créé / payé 2026-11-01**
- [~] Profil développeur / organisation (identité, contact) — **en cours de validation Google**
- [ ] Créer l’application **Mandala** (catégorie adaptée, pas « enfants ») — possible dès que la console le permet (souvent avant la fin totale de vérif)
- [ ] Package name figé, ex. `art.eludein.mandala` (aligné avec `assetlinks.json` / `PLAY_PACKAGE_NAME`)
- [ ] Activer **Play App Signing** (garder l’upload key ; noter le SHA-256 **App signing**) — après premier AAB

---

## 3. Abonnements Play Console + SKUs

Les digital goods in-app **doivent** passer par Play Billing dans l’app store.

- [ ] Créer 4 abonnements Play (mêmes offres que Stripe) :
  - place_monthly / place_yearly / pro_monthly / pro_yearly
- [ ] Noter les **product IDs / SKUs** Play
- [ ] Variables Coolify :
  - `PLAY_SKU_PLACE_MONTHLY`
  - `PLAY_SKU_PLACE_YEARLY`
  - `PLAY_SKU_PRO_MONTHLY`
  - `PLAY_SKU_PRO_YEARLY`
  - `PLAY_PACKAGE_NAME=art.eludein.mandala` (ou le package retenu)
- [ ] **Ne pas** laisser `PLAY_BILLING_STUB_ACK=1` en prod
- [ ] Compte de service Google Cloud + API **Google Play Android Developer** — procédure `docs/PLAY-STORE-API.md`
- [ ] JSON local : `nogit/play-certs/play-api-sa.json` (hors git)
- [ ] Lier le compte de service à la Play Console (présence store ; + droits financiers pour billing plus tard)
- [ ] Push fiche : `.\scripts\play-store-sync.ps1` (Node) — metadata `android-twa/fastlane/`
- [ ] Brancher la vérif réelle dans `next/src/lib/play-billing-verify.ts` (remplacer le stub)
- [ ] Secret Coolify : JSON compte de service (`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` ou fichier + `GOOGLE_APPLICATION_CREDENTIALS`)

---

## 4. Digital Asset Links (lien site ↔ app)

Sans ça, la TWA s’ouvre avec la barre Chrome (souvent rejet / mauvaise UX).

- [ ] Premier upload AAB (même en test interne) pour obtenir le SHA-256 **Play App Signing**
- [ ] Remplir `next/public/.well-known/assetlinks.json` :
  - `package_name` exact
  - empreinte SHA-256 (remplacer `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`)
- [ ] Déployer Coolify
- [ ] Vérifier `https://mandala.eludein.art/.well-known/assetlinks.json` (JSON public, HTTPS)
- [ ] Valider avec l’outil Digital Asset Links / Statement List Generator

---

## 5. Packaging TWA (Bubblewrap / PWABuilder)

- [ ] Installer Bubblewrap (ou PWABuilder) sur une machine de build
- [ ] `init` sur `https://mandala.eludein.art` (manifest, icônes, `start_url` `/app`)
- [ ] Générer l’**AAB** signé (upload key)
- [ ] Target API récent (suivre exigence Play en vigueur)
- [ ] Uploader en piste **interne** puis **test fermé**
- [ ] Smoke téléphone : pas de barre d’URL, login, mur, messages, offline page

---

## 6. Fiche store & politiques Play

- [ ] Titre, description courte / longue (FR) — textes prêts ; sync API `play-store-sync.ps1`
- [ ] Captures téléphone (+ tablette si déclarée) — assets dans `nogit/play-store-assets/`
- [ ] Icône 512, bannière feature graphic — idem
- [ ] Classification contenu / âge **13+** (pas Families / enfants)
- [ ] Questionnaire Data safety (compte, messages, notifs, paiement via Stripe/Play)
- [ ] URL politique de confidentialité : `https://mandala.eludein.art/confidentialite`
- [ ] URL CGU / support : pages légales + `contact@eludein.art`
- [ ] Déclarer UGC + modération / signalement / blocage
- [ ] Permissions (notifs ; géoloc seulement si réellement demandée)

---

## 7. Tests obligatoires avant prod Play

- [ ] Compte perso récent : **test fermé ≥ 12 testeurs, 14 jours** d’opt-in
- [ ] Parcours critique testeurs : inscription + CGU, message, signaler, bloquer, abo **Play** (sandbox), abo web sur PC (Stripe)
- [ ] Traiter au moins un signalement dans Admin → Modération
- [ ] Vérifier qu’un abo Stripe (PC) donne bien les droits aussi dans l’app Android (même compte)
- [ ] Vérifier qu’un abo Play n’est pas « double-facturé » via un CTA Stripe dans l’app Play

---

## 8. Soumission production & après

- [ ] Piste production → envoi en revue Google
- [ ] Corriger d’éventuels rejets (UGC, Data safety, assetlinks, crash offline)
- [ ] Annonce soft launch (lieux partenaires)
- [ ] Monitoring : webhooks Stripe, achats Play, signalements
- [ ] Process refunds : Stripe vs Google Play (doc support interne)
- [ ] (Plus tard) iOS / App Store — chantier séparé, plus contraignant pour les PWA

---

## Rappel architecture (ne pas dériver)

```
Modif code → push → Coolify → mandala.eludein.art
                              ├─ PC / navigateur (Stripe)
                              ├─ PWA installée
                              └─ App Play TWA (Play Billing)
```

On ne republie un AAB que si : icône, permissions Android, package, target API, ou config TWA — **pas** à chaque feature produit.

---

## Variables d’environnement (mémo)

| Variable | Rôle |
|----------|------|
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Paiement web |
| `STRIPE_PRICE_PLACE_*` / `STRIPE_PRICE_PRO_*` | Prix Stripe |
| `PLAY_SKU_PLACE_*` / `PLAY_SKU_PRO_*` | SKUs Play |
| `PLAY_PACKAGE_NAME` | Package Android |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Vérif achats Play |
| `PLAY_BILLING_STUB_ACK` | **Dev seulement** (`1`) |
| `MANDALA_BILLING_PUBLIC` | Porte offres publiques |
| `NEXT_PUBLIC_APP_URL` | URLs checkout / liens |
