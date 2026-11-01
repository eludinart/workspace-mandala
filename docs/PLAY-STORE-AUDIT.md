# Audit Mandala × `PLAY-STORE-AVOID-REJECTION.md`

> **Date :** 2026-11-01  
> **Périmètre :** codebase `c:\workspace-mandala` (Next.js) + intention TWA Bubblewrap (pas encore de projet Bubblewrap dans le repo)  
> **Prod smoke :** `https://mandala.eludein.art` (HTTP codes relevés le jour de l’audit)

Légende : **Respecté** · **À corriger** · **À décider** · **N/A (ops Console)** · **Non applicable**

---

## Synthèse exécutive

| Zone | Verdict |
|------|---------|
| UGC / CGU / signaler / bloquer | **Respecté dans le code local** ; **prod pas à jour** (pages légales 404) |
| Double paiement Stripe vs Play | **À corriger** — fallback Stripe possible dans un TWA si Play Billing API absente / SKU manquant |
| Asset links | **À corriger** — placeholder SHA + **404 en prod** |
| HTTPS / health | **Respecté** (`/api/health` 200) |
| Icônes maskable | **Partiel** — déclarées ; safe-zone à valider visuellement |
| Data safety / ciblage / ads / test fermé | **N/A code** — à remplir en Console |
| Bubblewrap AAB | **Absent du repo** — ops à faire |

**Compromis web + Android recommandé :**  
1) Déployer le socle Play (légal, SW, assetlinks).  
2) Dans tout contexte Android/TWA : **interdire Stripe** pour Lieu/Pro (cacher CTA ou Play Billing uniquement).  
3) Sur navigateur desktop : Stripe inchangé.  
4) Tant que SKUs Play ne sont pas prêts : CTA achat **cachés** dans TWA ; social gratuit suffit pour la revue.

---

## 0. Règles d’or

| Point | Statut | Preuve / note |
|-------|--------|----------------|
| Une seule app web Coolify | **Respecté** (archi) | Pas de fork natif ; pas encore d’AAB |
| Jamais Stripe dans contexte Play pour digital goods | **Violé (risque)** | `BillingOffersPage` retombe sur Stripe si `!playAvailable` ou SKU Play manquant alors que Stripe `configured` |
| UGC signaler + bloquer + CGU | **Respecté (code)** | Voir §2.1 ; **prod** : CGU/privacy **404** |
| Pas d’enfants 13+ | **Respecté (copy)** | Case inscription + CGU ; **À décider** : écran d’âge neutre dédié vs case seule |
| Pas de pubs | **Respecté** | Aucun AdMob / pixel pubs trouvé |

---

## 1. Checklist conformité Console

### 1.1 Ciblage

| Point | Statut |
|-------|--------|
| Audience 13+ | **N/A (ops)** — déclarer en Console ; copy app OK |
| Pas Families / kids | **N/A (ops)** |
| Catégorie Social / lifestyle | **N/A (ops)** |
| UGC = Oui | **N/A (ops)** — doit être Oui |
| Violence / sexualité honnête | **N/A (ops)** |
| News / COVID / crypto Non | **N/A (ops)** |

### 1.2 Data safety

| Point | Statut |
|-------|--------|
| Formulaire Data safety | **N/A (ops)** — à remplir |
| Alignement privacy | **À corriger (prod)** : `/confidentialite` → **HTTP 404** aujourd’hui ; **Respecté (code local)** pages existantes |
| Suppression de compte | **Respecté (code)** Compte → supprimer |
| Pas de vente / pubs | **Respecté (code)** |
| Localisation précise | **Respecté** — pas de `geolocation` / `getCurrentPosition` dans `next/src` |
| Push / achats à déclarer | **À décider / ops** si notifs et abo ouverts |

### 1.3 Publicités

| Point | Statut |
|-------|--------|
| Déclarer no ads | **N/A (ops)** |
| Pas AdMob | **Respecté** |

### 1.4 Listing

| Point | Statut |
|-------|--------|
| Textes FR | **Respecté** `docs/PLAY-STORE-LISTING.md` |
| Captures réelles | **N/A (ops)** |
| Support / CGU URLs | **À corriger (prod)** CGU 404 jusqu’au deploy |

### 1.5 Test fermé 12×14 j

| Point | Statut |
|-------|--------|
| Testeurs | **N/A (ops)** |

---

## 2. Vigilance Mandala

### 2.1 UGC

| Point | Code local | Prod |
|-------|------------|------|
| Acceptation CGU inscription | **Respecté** | Idem si API déployée |
| Gate comptes anciens | **Respecté** `TermsAcceptanceGate` | Idem |
| Signaler mur | **Respecté** `AgoraFeed` | Idem |
| Signaler + bloquer messagerie | **Respecté** `DialogueStream` | Idem |
| Admin Modération | **Respecté** | Idem |
| Pages légales publiques | **Respecté** `/cgu` `/cgv` `/confidentialite` | **Violé** : **404** |
| Signaler partout (events, skills, annonces…) | **Partiel / À décider** | Seulement mur + DM + returns |

### 2.2 Double paiement — **point critique**

| Scénario | Comportement actuel | Verdict |
|----------|---------------------|---------|
| Desktop, Stripe OK | Checkout Stripe | **Respecté** |
| TWA + Digital Goods + `PLAY_SKU_*` | Play Billing | **Respecté** (si SKUs configurés) |
| TWA **sans** Digital Goods API (échec détection) | **Fallback Stripe** (`createCheckoutSession`) | **Violé** |
| TWA + Play API OK mais **pas** de `PLAY_SKU_*` | Boutons disabled « bientôt » si `playAvailable` ; sinon risque Stripe | **À corriger** |
| Compte → « Gérer abonnement Stripe » | Visible même sur Android | **À corriger** (masquer ou libellé conditionnel en TWA) |
| `PLAY_SKU_*` Coolify | Non vus en env prod audit Stripe précédent | **À corriger (ops)** |
| Vérif Play serveur | Stub / credentials manquants | **À corriger** avant abo Play live |
| Bubblewrap dans repo | Absent | **À corriger (ops)** |

**Correction concrète recommandée (code) :**

1. `isPlayDistributionContext()` = Android + (`isPlayBillingAvailable()` **OU** `display-mode: standalone` / referrer TWA / query `utm_source=play`).  
2. Si contexte Play :  
   - **jamais** appeler `createCheckoutSession` ;  
   - si pas de SKU Play → message « Abonnement disponible via le site mandala.eludein.art ou bientôt in-app » **sans** bouton Stripe ;  
   - option safe revue : cacher toute la section checkout tant que `play_configured` faux.  
3. Masquer / adapter le bouton portail Stripe hors web.  
4. Option Bubblewrap : `additionalTrustedOrigins` + extra query `?dist=play` injecté au `startUrl`.

### 2.3 Abonnements Lieu / Pro

| Point | Statut |
|-------|--------|
| Prix 29 / 12 | **Respecté** catalogue |
| Social gratuit sans paywall | **Respecté** |
| Porte `MANDALA_BILLING_PUBLIC=0` | **Respecté** (prod smoke products `billing_public: false`) — aide la revue |
| Badge = abo + validation | **Respecté** plan produit |

### 2.4 Permissions

| Point | Statut |
|-------|--------|
| Pas GPS code | **Respecté** |
| Notifications Web Push | **Respecté** (opt-in) — déclarer en Console ; Bubblewrap : ne pas ajouter permissions Android inutiles |
| Projet Bubblewrap | **Absent** — à créer sans `ACCESS_FINE_LOCATION` |

---

## 3. Technique TWA

### 3.1 HTTPS & stabilité

| Point | Statut | Preuve |
|-------|--------|--------|
| HTTPS prod | **Respecté** | health 200 |
| `/api/health` | **Respecté** | 200 |
| Offline SW + `/offline.html` | **Respecté (code)** ; **prod offline.html → 404** | Deploy manquant |
| Mixed content | Non audité exhaustivement | Smoke manuel images HTTP |

### 3.2 Asset links

| Point | Statut |
|-------|--------|
| Fichier dans repo | **Présent** `next/public/.well-known/assetlinks.json` |
| SHA réel | **Violé** — `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` |
| Servi en prod | **Violé** — **HTTP 404** (HTML 404 Next) |
| Package name | **Respecté** intention `art.eludein.mandala` |

### 3.3 Manifest & icônes

| Point | Statut |
|-------|--------|
| manifest name / start_url `/app` / standalone | **Respecté** |
| icon 192 / 512 | **Respecté** (fichiers public) |
| purpose maskable | **Partiel** — même fichier que `any` ; **À décider** : générer asset maskable avec safe zone |
| Splash Bubblewrap | **N/A** tant que pas d’init Bubblewrap |

### 3.4 Bubblewrap / AAB

| Point | Statut |
|-------|--------|
| Projet / AAB | **Absent** → **À corriger (ops)** |
| Target API / signing | **N/A** jusqu’au packaging |

### 3.5 Session TWA

| Point | Statut |
|-------|--------|
| Cookies auth web | **Probable OK** — smoke device requis |
| Retour checkout Play | **À tester** après SKUs |

---

## 4. Preuves prod (audit jour J)

| URL | Résultat |
|-----|----------|
| `/api/health` | **200** |
| `/cgu` | **404** |
| `/confidentialite` | **404** |
| `/.well-known/assetlinks.json` | **404** (page Next not-found) |
| `/offline.html` | **404** (relevé session curl) |
| Code local pages légales / SW / assetlinks | **Présent** — **non déployé** |

→ Tant que le deploy n’est pas fait, **soumettre Play = rejet probable** (privacy 404, DAL KO).

---

## 5. Liste actionnable

### Respecté (garder)

- Social gratuit sans paywall  
- CGU acceptation + gate (code)  
- Signaler mur + DM, bloquer 1:1, admin modération (code)  
- Suppression de compte (code)  
- Pas de pubs / pas de GPS  
- Dual-rail **intention** Play-first quand API + SKU OK  
- HTTPS + health  
- Listing FR documenté  
- Porte billing fermée au public  

### À corriger (bloqueurs revue)

1. **Deploy** Coolify : pages `/cgu` `/cgv` `/confidentialite`, `offline.html`, `assetlinks.json`, SW, billing portal/smoke.  
2. **Code anti-Stripe TWA** : interdire fallback Stripe en contexte Play (voir §2.2).  
3. **Asset links** : SHA Play App Signing réel + redeploy.  
4. **Masquer / adapter** CTA « Gérer abonnement Stripe » hors web.  
5. **SKUs Play + vérif** avant d’afficher boutons d’achat in-app.  
6. **Créer AAB Bubblewrap** (hors repo aujourd’hui).

### À décider

- Cacher totalement les offres payantes dans TWA jusqu’à Play Billing vert **vs** afficher Play-only.  
- Générer une vraie icône **maskable** dédiée.  
- Écran d’âge neutre séparé (au-delà de la case 13 ans).  
- Étendre « Signaler » aux événements / compétences / annonces.  
- EUR-only vs multi-devise (hors critique revue immédiate).  

### N/A (Console / ops humains)

- Data safety form  
- Questionnaire 13+ / UGC / no ads  
- Captures store  
- 12 testeurs × 14 jours  
- Identité développeur  

---

## 6. Ordre de correctifs (compromis web + Android)

```
1. Commit + push + deploy socle Play (légal, SW, assetlinks placeholder)
2. Patch BillingOffersPage + AccountPage : zero Stripe en contexte Play
3. Remplir SHA assetlinks après premier AAB / App Signing
4. Créer SKUs Play OU garder CTA cachés in-app
5. Test fermé → Data safety → prod
```

Web reste Stripe ; Android Play ne voit jamais Stripe Checkout pour Lieu/Pro.
