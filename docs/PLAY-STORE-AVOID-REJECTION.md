# Mandala — Guide anti-rejet Google Play (TWA Bubblewrap)

> **Objectif :** passer la revue Play **du premier coup** (ou au pire au 2ᵉ essai), sans embûches classiques des PWA / TWA / apps sociales.  
> **App :** Mandala · URL prod `https://mandala.eludein.art` · package prévu `art.eludein.mandala`  
> **Packaging :** Trusted Web Activity (Bubblewrap / PWABuilder)  
> **Compléments :** `docs/PLAY-STORE-ROADMAP.md` · `docs/PLAY-STORE-LISTING.md` · `docs/MONETIZATION-PLAN.md`

Coche chaque case **avant** d’envoyer en revue production.

---

## 0. Règle d’or (Mandala)

1. **Une seule app web** = Coolify. L’AAB Play n’est qu’une coque.  
2. **Ne jamais** proposer un checkout **Stripe** dans le contexte Google Play pour Lieu / Mandala Pro → **Play Billing** only in-app.  
3. **UGC** = signaler + bloquer + CGU acceptées + modération admin, **avant** soumission.  
4. **Pas d’enfants** (13+).  
5. **Pas de pub** tierce v1 → le déclarer clairement.

---

## 1. Checklist conformité Play Console

### 1.1 Ciblage & classification

- [ ] Audience **13 ans et plus** (questionnaire contenu)  
- [ ] **Ne pas** cocher Families / Designed for children / kids  
- [ ] Catégorie : Social ou Style de vie (pas Enfants)  
- [ ] Contenu généré par utilisateurs (**UGC**) : **Oui**  
- [ ] Violence / sexualité : répondre honnêtement ; UGC modéré, pas de contenu adulte promu  
- [ ] News / COVID / crypto : Non (sauf si un jour ajouté)

### 1.2 Data safety (formulaire le plus piégeux)

Déclarer **exactement** ce que Mandala collecte (aligné sur `/confidentialite`) :

| Donnée | Collectée ? | Partagée ? | Obligatoire ? | Finalité typique |
|--------|-------------|------------|---------------|------------------|
| E-mail | Oui | Non (sauf prestataires sous-traitants) | Oui compte | Compte, auth |
| Nom / prénom | Oui | Non | Oui | Profil |
| Messages / UGC | Oui | Non (privé au réseau) | Selon usage | Fonctionnalité |
| Identifiants appareil / push | Oui si notifs | Non | Non (opt-in) | Notifications |
| Achats | Oui (Stripe / Play) | Avec processeur paiement | Si abo | Facturation |
| Localisation précise | **Non** sauf si GPS demandé un jour | — | — | Aujourd’hui : coords lieux saisies / carte, pas tracking user GPS → ne pas cocher « precise location » si non utilisé |
| Pub / tracking pub | **Non** | — | — | Pas de pubs |

Cases Data safety à cocher / remplir :

- [ ] Collecte de données : **Oui**  
- [ ] Sécurité des données en transit : **Oui** (HTTPS)  
- [ ] Suppression de compte : **Oui** — chemin Compte → supprimer ; URL privacy  
- [ ] URL politique de confidentialité : `https://mandala.eludein.art/confidentialite`  
- [ ] Pas de vente de données  
- [ ] Pas de ciblage pub / shared with ad networks  
- [ ] Engagements : chiffrement transit ; (suppression sur demande = compte)

**Piège :** déclarer « pas de données » alors qu’il y a un compte → rejet quasi sûr.

### 1.3 Publicités

- [ ] Déclarer **Pas de publicités** dans l’app (v1)  
- [ ] Ne pas intégrer AdMob / réseaux pubs « pour tester »

### 1.4 Contenu & store listing

- [ ] Textes / description FR prêts (`docs/PLAY-STORE-LISTING.md`) — **sans** promettre des features absentes  
- [ ] Captures réelles de **l’app**, pas mockups mensongers  
- [ ] Icône 512 cohérente avec le manifest  
- [ ] Pas de mentions d’autres stores / « aussi sur iOS » dans le listing si non pertinent  
- [ ] Support e-mail : `contact@eludein.art`  
- [ ] CGU accessibles : `https://mandala.eludein.art/cgu`

### 1.5 Tests pré-prod (compte perso récent)

- [ ] Piste **test fermé** ≥ **12 testeurs** opt-in pendant **14 jours** (exigence comptes perso post-nov 2023)  
- [ ] Les testeurs ont **vraiment** ouvert l’app (pas seulement invités)  
- [ ] Parcours critique validé par au moins 2 personnes hors équipe

---

## 2. Vigilance spécifique Mandala

### 2.1 UGC (mur, messages, profils, compétences)

Déjà en code — **vérifier en prod avant revue** :

- [ ] Acceptation CGU à l’inscription (case + API `accept_cgu`)  
- [ ] Gate CGU pour comptes anciens  
- [ ] Bouton **Signaler** (mur + messagerie)  
- [ ] **Bloquer** en conversation 1:1 + refus d’envoi serveur  
- [ ] Admin → onglet **Modération** (traiter au moins 1 signalement test)  
- [ ] Pages `/cgu` `/confidentialite` joignables **sans login**  
- [ ] Dans le questionnaire Play : UGC = oui + modération = oui

**Rejet fréquent :** « UGC without a reporting mechanism » → si le bouton est caché ou cassé sur mobile TWA, c’est comme s’il n’existait pas.

### 2.2 Double paiement (Stripe web / Play in-app)

- [ ] Dans le **TWA** : détection Play Billing → **jamais** rediriger vers Stripe Checkout pour Lieu / Pro  
- [ ] Sur **PC / navigateur** : Stripe OK  
- [ ] SKUs Play créés et `PLAY_SKU_*` en Coolify **avant** d’ouvrir les CTA abo in-app  
- [ ] `PLAY_BILLING_STUB_ACK` **absent** ou `0` en prod  
- [ ] Si les CTA abo ne sont **pas** encore prêts Play : **cacher** les boutons d’achat dans le contexte Play (sinon rejet Payments)  
- [ ] Data safety : déclarer achats in-app / abonnements  
- [ ] Résiliation : doc claire — Stripe via portail Compte ; Play via Google Play → Abonnements

**Rejet / retire fréquent :** digital goods vendus hors Play Billing dans une app distribuée par Play.

### 2.3 Abonnements Lieu / Mandala Pro

- [ ] Prix listing / CGV alignés (29 € / 12 €) — écart Play OK si taxes store  
- [ ] Badge / listing : cohérent avec `docs/MONETIZATION-PLAN.md` (pas de promesse « badge sans validation »)  
- [ ] Porte `MANDALA_BILLING_PUBLIC` : si `0`, les testeurs non-admin ne voient pas les CTA — OK pour revue **si** l’app reste utile sans payer (social gratuit)  
- [ ] Ne pas rendre l’app **inutilisable** sans paiement (paywall total) → rejet « misleading » / valeur insuffisante

### 2.4 Permissions Android (Bubblewrap)

Ne demander **que** ce qui est utilisé :

- [ ] Notifications : OK si Web Push / permission runtime justifiée  
- [ ] **Pas** de `ACCESS_FINE_LOCATION` si pas de GPS user  
- [ ] Pas de contacts / SMS / call log  
- [ ] Justifier chaque permission dans la fiche « App content » / permissions

---

## 3. Exigences techniques TWA (Bubblewrap)

### 3.1 HTTPS & stabilité

- [ ] `https://mandala.eludein.art` force HTTPS (Coolify)  
- [ ] `/api/health` → OK  
- [ ] `/app` charge sans 5xx  
- [ ] Pas de mixed content (HTTP images) sur les parcours login / home  
- [ ] Service worker : page offline `/offline.html` (évite « crash » navigue hors ligne)

### 3.2 Digital Asset Links (critique TWA)

- [ ] Fichier servi : `https://mandala.eludein.art/.well-known/assetlinks.json`  
- [ ] `package_name` = package exact de l’AAB  
- [ ] SHA-256 = **Play App Signing** (Console → App integrity), **pas** seulement la clé upload  
- [ ] Remplacer `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`  
- [ ] Content-Type JSON, accessible sans auth, pas de redirect cassant  
- [ ] Vérifier avec [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) / API DAL  
- [ ] Sur device : **pas de barre d’URL Chrome** au lancement (sinon asset links KO → Custom Tab = mauvaise UX / souvent rejeté comme « incomplete »)

### 3.3 Manifest & icônes

- [ ] `manifest.webmanifest` : `name`, `short_name`, `start_url` `/app`, `display` `standalone`  
- [ ] Icônes **192** et **512**  
- [ ] Icône **maskable** (safe zone : logo pas collé aux bords) — aujourd’hui `icon-512` en `purpose: maskable` : **vérifier visuellement** le masque Android  
- [ ] `theme_color` / `background_color` cohérents  
- [ ] Splash Bubblewrap alignée (pas d’écran blanc 10 s)

### 3.4 Bubblewrap / AAB

- [ ] `startUrl` = `https://mandala.eludein.art/app` (ou équivalent HTTPS)  
- [ ] Target SDK / API level **à jour** (exigence Play en vigueur au moment du dépôt)  
- [ ] AAB signé ; Play App Signing activé  
- [ ] VersionCode incrémenté à chaque upload  
- [ ] Smoke sur téléphone réel **après** asset links prod déployés

### 3.5 WebView / Chrome

- [ ] App testée sur Android récent + un device plus vieux (API min Bubblewrap)  
- [ ] Login cookie / session OK dans TWA  
- [ ] Deep link retour après checkout Play

---

## 4. Raisons de rejet les plus fréquentes (à éviter)

| Motif Google (résumé) | Comment Mandala l’évite |
|------------------------|-------------------------|
| UGC sans signalement / modération | Signaler + bloquer + admin Modération + CGU |
| Contenu / Data safety faux | Formulaire aligné sur privacy réelle |
| Families / enfants mal déclarés | 13+ strict, pas Families |
| Paiements digitaux hors Play Billing | Stripe **uniquement** hors TWA ; Play Billing in-app |
| App « juste un site » sans valeur / cassée | Smoke `/app`, offline, pas de barre URL, parcours social utile |
| Asset Links KO / Custom Tab | SHA Play App Signing correct + JSON public |
| Permissions excessives | Pas de GPS / contacts inutiles |
| Privacy policy manquante ou 404 | URL HTTPS stable |
| Compte non vérifié / identité | Attendre validation identité avant prod si bloquant |
| Test fermé insuffisant | 12 testeurs × 14 jours |
| Listing trompeur | Textes = features réelles |
| Crash au lancement / offline | SW + offline.html + health OK |
| Suppression de compte absente | Chemin Compte déjà prévu — tester en TWA |
| Pubs non déclarées | Pas de pubs + déclaration « no ads » |

---

## 5. Runbook « jour J » avant Envoyer en revue

### J−7

- [ ] Identité / organisation Play validée (ou non bloquante pour la piste choisie)  
- [ ] AAB en test fermé installable  
- [ ] Asset links verts (pas de barre URL)  
- [ ] CGU / privacy / signaler / bloquer / delete account smoke mobile

### J−2

- [ ] Data safety relu une fois à deux  
- [ ] Captures à jour  
- [ ] Si abo in-app visibles : Play Billing smoke (carte test)  
- [ ] Si abo non prêts : CTA achat **cachés** dans TWA

### J−0

- [ ] Relire le mail / questionnaire « App content »  
- [ ] Notes de version (`PLAY-STORE-LISTING.md`)  
- [ ] Envoyer production **ou** rester en fermé si un doute paiement / DAL

### Si rejet

1. Lire le motif exact (lettre Play).  
2. Corriger **une** cause racine (ne pas tout changer).  
3. Répondre dans la Console avec preuves (captures signaler, URL privacy, DAL).  
4. Nouveau build seulement si code / AAB impacté.

---

## 6. État Mandala (rappel rapide)

| Sujet | État code | Action restante ops |
|-------|-----------|---------------------|
| CGU / privacy / acceptation | Fait | Personnaliser SIRET / adresse si besoin |
| Signaler / bloquer / admin | Fait | Smoke TWA |
| Dual Stripe / Play | Socle fait | SKUs Play + vérif API + pas de stub |
| Offline SW | Fait | Smoke hors ligne |
| assetlinks.json | Placeholder | SHA-256 réel |
| Listing FR | `PLAY-STORE-LISTING.md` | Coller en Console |
| Data safety | — | Remplir à la main dans Console |

---

## 7. Liens utiles

- Digital Asset Links : https://developers.google.com/digital-asset-links/v1/getting-started  
- TWA + Play Billing : https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing  
- UGC policy : https://support.google.com/googleplay/android-developer/answer/9876937  
- Data safety : https://support.google.com/googleplay/android-developer/answer/10787469  
- Roadmap Mandala : `docs/PLAY-STORE-ROADMAP.md`
