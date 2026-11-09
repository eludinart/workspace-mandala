# Procédure Play Store — réutilisable (Élude)

> Marche à suivre **complète** pour publier une app (TWA / AAB) sur Google Play.  
> Exemple concret : **Mandala** (`art.eludein.mandala`, `https://mandala.eludein.art`).  
> Adapter package, URLs, prix et textes pour les prochaines apps.

**Compléments Mandala :**  
`PLAY-STORE-ROADMAP.md` · `PLAY-STORE-API.md` · `PLAY-STORE-MANUAL-NEXT.md` · `PLAY-STORE-DATA-SAFETY.md` · `PLAY-STORE-AVOID-REJECTION.md` · `PLAY-STORE-LISTING.md` · `STRIPE-SETUP-MANDALA.md`

---

## 0. Principes

1. **Une seule app web** (Coolify) + coque **TWA / Bubblewrap** = AAB Play.  
2. Digital goods in-app → **Play Billing only** (jamais Stripe dans le TWA).  
3. Stripe reste le rail **web / PC**.  
4. **Ne pas publier en production** sans accord explicite. Envoi pour **examen** (internal / closed / open) = OK.  
5. Questionnaires **Data safety / UGC / IARC** = **toujours manuels** (Console) — l’API ne les couvre pas.  
6. Compte perso post-2023 : piste test fermé ≥ **12 testeurs** opt-in **14 jours** avant prod (voir anti-rejet).

---

## 1. Prérequis compte & paiements

| Étape | Où | Notes |
|-------|-----|--------|
| Compte développeur payé | Play Console | Frais unique |
| Organisation / identité | Gérer le compte | Bannière « statut de professionnel » si demandée |
| **Profil de paiements** + IBAN / SWIFT | Paramètres → Profil de paiements | **Bloque** la création d’abonnements tant que non validé |
| Compte de service API | Cloud + invitation Play | Voir `PLAY-STORE-API.md` → `nogit/play-certs/play-api-sa.json` |

Sans profil paiements validé :  
`Cannot create a subscription without first registering a payments profile`.

---

## 2. Package, signing, asset links

1. Choisir un **package name** stable (ex. `art.eludein.mandala`).  
2. Premier AAB → activer **Play App Signing** → noter le SHA-256 **App signing** (et upload key).  
3. Publier Digital Asset Links sur le domaine HTTPS de l’app :

```text
https://<domaine>/.well-known/assetlinks.json
```

Fichier type (`next/public/.well-known/assetlinks.json`) :

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "art.eludein.mandala",
    "sha256_cert_fingerprints": [
      "<SHA-256 App signing Play>",
      "<SHA-256 upload key si besoin>"
    ]
  }
}]
```

- Pas d’empreinte vide / placeholder.  
- Après deploy Coolify, vérifier l’URL publique.  
- TWA : `asset_statements` / Bubblewrap alignés sur le même package.

---

## 3. Build AAB (TWA)

Repo Mandala : dossier `android-twa/` (Bubblewrap).

Sorties typiques :

- `android-twa/app/build/outputs/bundle/release/app-release.aab`
- ou `android-twa/app-release-bundle.aab`

Uploader l’AAB dans Play Console → **Tester et publier** → piste choisie.  
Version codes croissants. Garder une copie hors git si besoin (`nogit/`).

---

## 4. Fiche Play Store (textes + images)

### 4.1 Sources

| Élément | Emplacement Mandala |
|---------|---------------------|
| Titre / short / full | `android-twa/fastlane/metadata/android/fr-FR/` (+ `docs/PLAY-STORE-LISTING.md`) |
| Icône 512, feature 1024×500 | `nogit/play-store-assets/` |
| Captures téléphone | `nogit/play-store-assets/01-….png` … (portrait, 320–3840 px, 9:16 ou 16:9) |

Captures : **vues réelles de l’app** (pas CGU / login seuls). Mandala : Playwright mobile → 1170×2532 (`nogit/play-store-assets/_capture-phone.mjs`).

### 4.2 Sync API

```powershell
cd c:\workspace-mandala
.\scripts\play-store-sync.ps1 -DryRun          # vérif chemins
.\scripts\play-store-sync.ps1 -TextsOnly       # textes
.\scripts\play-store-sync.ps1 -ImagesOnly      # icon + feature + phoneScreenshots
.\scripts\play-store-sync.ps1                 # tout
```

Prérequis : `GOOGLE_APPLICATION_CREDENTIALS` ou `nogit/play-certs/play-api-sa.json`  
(détail : `docs/PLAY-STORE-API.md`).

---

## 5. Abonnements SKU (Play Billing)

### 5.1 Création Console

**Monétiser avec Play → Abonnements → Créer un abonnement**

Pour chaque offre (exemple Mandala) :

| Product ID | Nom court (e-mails / centre abo) | Prix | Période |
|------------|----------------------------------|------|---------|
| `place_monthly` | Offre Lieu — mensuel | 29,00 € | 1 mois |
| `place_yearly` | Offre Lieu — annuel | 290,00 € | 1 an |
| `pro_monthly` | Mandala Pro — mensuel | 12,00 € | 1 mois |
| `pro_yearly` | Mandala Pro — annuel | 120,00 € | 1 an |

Wizard typique :

1. ID produit + Nom → **Créer**  
2. Ajouter un **forfait de base** (base plan) : période, prix EUR, renouvellement auto  
3. Description / avantages visibles store si demandés  
4. **Activer** le forfait (draft → active)

Les `productId` doivent **matcher** les env de l’app.

### 5.2 Variables d’environnement (Coolify)

```text
PLAY_PACKAGE_NAME=art.eludein.mandala
PLAY_SKU_PLACE_MONTHLY=place_monthly
PLAY_SKU_PLACE_YEARLY=place_yearly
PLAY_SKU_PRO_MONTHLY=pro_monthly
PLAY_SKU_PRO_YEARLY=pro_yearly
# Ne pas laisser PLAY_BILLING_STUB_ACK=1 en prod
```

Rail web (Mandala) :

```text
STRIPE_SECRET_KEY=…
STRIPE_WEBHOOK_SECRET=…
STRIPE_PRICE_PLACE_MONTHLY=…
STRIPE_PRICE_PLACE_YEARLY=…
STRIPE_PRICE_PRO_MONTHLY=…
STRIPE_PRICE_PRO_YEARLY=…
MANDALA_BILLING_PUBLIC=0   # 1 seulement après smoke Stripe volontaire
NEXT_PUBLIC_APP_URL=https://mandala.eludein.art
```

Vérif catalogue prod :

```text
GET https://mandala.eludein.art/api/billing/products
→ billing_public, products[].configured, products[].play_configured / play_sku
```

---

## 6. Questionnaires manuels (App content)

Ordre utile (dashboard « Configurer votre application ») — détails réponses Mandala dans `PLAY-STORE-DATA-SAFETY.md` + `PLAY-STORE-MANUAL-NEXT.md` :

1. **Politique de confidentialité** → URL HTTPS publique (`/confidentialite`)  
2. **Informations de connexion** (compte testeur revue)  
3. **Annonces** → Non (si pas de pubs)  
4. **Classification IARC**  
5. **Cible** → 13+ ; **pas** Families / enfants  
6. **Sécurité des données (Data safety)** → collecte oui, HTTPS, pas de vente, achats si abo, pas de localisation précise user GPS  
7. **UGC** → Oui + signalement + modération + CGU  
8. **Applis gouvernementales** → Non (sauf cas réel)  
9. **Fonctionnalités financières** → abonnements / paiements in-app si Play Billing  
10. **Santé** → Non (sauf cas réel)  
11. **Catégorie + contacts** → ex. Social ; `contact@…` ; site  
12. **Fiche Play Store** → textes + graphismes OK  

Tant que ces tâches sont ouvertes : bouton **Envoyer pour examen** souvent **grisé** ; lien opt-in test interne absent.

---

## 7. Pistes de test & testeurs

| Piste | Usage |
|-------|--------|
| **Internal** | Smoke équipe, opt-in rapide (liste e-mails / Google Group) |
| **Closed (alpha)** | Test fermé plus large |
| **Open (beta)** | Optionnel |
| **Production** | Public — **accord explicite** avant publication |

### 7.1 Rattacher une liste (ex. `elude_interne`)

1. **Tester et publier → Test interne → Testeurs**  
2. Cocher la liste / groupe → **Enregistrer**  
3. Vérifier API ou UI : liste réellement attachée (sinon `edits.testers` peut rester `{}`)  
4. Lien opt-in :  
   `https://play.google.com/apps/testing/<package.name>`  
   (affiché aussi dans la Console une fois la config minimale OK)

### 7.2 États release (API `edits.tracks`)

Exemple Mandala (nov 2026) :

- `internal` / `alpha` : `completed` pour version `1 (1)`  
- `production` : `draft` tant que non envoyé / non publié  

**Envoi pour examen** ≠ mise en ligne prod automatique selon le mode de publication du compte — vérifier la vue **Publication**.

---

## 8. Envoi pour examen & publication

**Mandala : publication gérée ACTIVÉE.** Un `edits.commit` / upload API qui met la piste en `completed` **ne suffit pas** : la version reste « prête à publier » jusqu’au clic manuel **Publier**.

Procédure complète (à aller jusqu’au bout) :

1. Compléter dashboard (section 6).  
2. AAB signé uploadé sur la piste (internal d’abord ; prod seulement avec accord).  
3. Console → **Vue d’ensemble de la publication**  
   - **Envoyer pour examen** si besoin  
   - Attendre l’approbation Google  
4. Quand « Modifications prêtes à être publiées » apparaît → **Publier N modification(s)** → confirmer **Publier des modifications**.  
5. Vérifier que la section « prêtes à publier » est vide et que « Dernière publication » est à jour.  
6. Smoke store : fiche Play affiche le bon `versionCode` (pas seulement l’API tracks).

Sans l’étape 4, le téléphone peut rester sur l’ancienne version (ex. v1) alors que l’API dit déjà `production = completed`.

Après examen internal + testeurs opt-in : installer, smoke TWA (pas de barre Chrome Custom Tabs indésirable, login, Play Billing si SKUs actifs).

---

## 9. Checklist smoke post-go

- [ ] `/.well-known/assetlinks.json` HTTPS 200, empreintes non vides  
- [ ] `/api/health` OK  
- [ ] `/api/billing/products` : SKUs `play_configured`  
- [ ] Web : checkout Stripe (si `MANDALA_BILLING_PUBLIC=1` ou compte admin)  
- [ ] TWA : CTA Stripe **absent** ; Digital Goods / Payment Request OK  
- [ ] Compte → portail Stripe **masqué / libellé adapté** en contexte Play  
- [ ] Signalement UGC + CGU gate  
- [ ] Listing FR cohérent avec prix réels  

---

## 10. Scripts & chemins (Mandala)

| Rôle | Chemin |
|------|--------|
| Sync fiche API | `scripts/play-store-sync.ps1` → `scripts/play-store/sync.mjs` |
| Metadata fastlane | `android-twa/fastlane/metadata/android/fr-FR/` |
| Assets graphiques | `nogit/play-store-assets/` |
| SA JSON | `nogit/play-certs/play-api-sa.json` |
| Capture téléphone | `nogit/play-store-assets/_capture-phone.mjs` |
| Porte billing | `next/src/lib/billing-door.ts` (`MANDALA_BILLING_PUBLIC`) |
| Client Play | `next/src/lib/play-billing-client.ts` |
| Ack serveur | `next/src/app/api/billing/play/acknowledge/route.ts` |
| Asset links | `next/public/.well-known/assetlinks.json` |
| Reste manuel | `docs/PLAY-STORE-MANUAL-NEXT.md` |

Pour une **nouvelle app** : copier cette procédure, dupliquer le pattern `scripts/play-store*` + `android-twa` / Bubblewrap, créer un SA (ou partager le même avec droits sur la nouvelle appli), nouveaux `PLAY_SKU_*` / package / domaine.

---

## 11. Ordre recommandé (récap)

```text
Profil paiements validé
  → Package + AAB + App Signing + assetlinks
  → Fiche (sync.ps1) + captures téléphone
  → 4 SKUs abonnements + env Coolify
  → Questionnaires App content
  → Testeurs (internal) + Envoyer pour examen
  → Smoke TWA / Billing
  → [Accord] Production
```

*Dernière consolidation : 2026-11-05 — procédure générique à partir du run Mandala.*
