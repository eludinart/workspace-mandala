# Design — Accueil « Explorer Mandala » (compte sans lieu)

Date : 2026-11-11  
Statut : accepted · implémentation  
Checklist observation : `docs/CHECKLIST-UX-SANS-LIEU.md`

## Problème

Une personne **connectée** mais **rattachée à aucun lieu** (après « Continuer sans lieu », ou après avoir quitté son dernier lieu) arrive sur un accueil presque vide : trois boutons (Rejoindre / Annuaire / Ma fiche).  

La **landing publique** montre déjà le réseau vivant (carte, mur, lieux). L’app, au même moment de vérité (compte créé), **coupe** cette présence. Le libellé « Sans lieu » sonne comme un statut d’échec.

## Décisions verrouillées

1. **Approche** : **A** (accueil solo = mini-landing vivante) **+ touche de B** (bandeau d’étapes court).
2. **Double objectif** de l’accueil : **sentir le réseau** (mur / carte) **et** être guidé·e vers **rejoindre un lieu**.
3. **Framing** : mode **« Explorer Mandala »**, plus « Sans lieu » comme titre / eyebrow principal.
4. **Après skip onboarding** : atterrir sur cet **accueil enrichi** (pas un écran vide).
5. **Fiche** : **un seul rappel discret** (« Complétez votre fiche pour apparaître »), **pas de quiz**. Règle = option **1** (§ Fiche).
6. **Fiche lieu depuis le mur / carrousel** : CTA **Rejoindre** bien visible.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| B seul (checklist sans mur) | Reste pauvre ; le vide ressenti continue |
| C (accueil = Découvrir par défaut) | Pas de « chez moi » ; confusion Accueil / Découvrir |
| Reproduire toute la landing (tarifs, « vous gérez un lieu ») | Hors besoin ; bruit commercial dans l’espace perso |
| Forcer un lieu avant l’app | Contredit le skip « Continuer sans lieu » déjà livré |
| Questionnaire post-inscription | Interdit par la Suite (« pas de questionnaire à la connexion ») |

## Périmètre

### Qui voit quoi

| État | Accueil |
| --- | --- |
| ≥ 1 lieu | Accueil lieu actuel (inchangé : hero lieu, météo, programmes, agora…) |
| 0 lieu + `continue_without_place` (ou équivalent déjà marqué) | **Explorer Mandala** (ce design) |
| 0 lieu + onboarding place encore requis | `OnboardingGate` / `PlaceSelectionScreen` (inchangé) |

### Hors scope

- Changer le modèle d’appartenance ou l’API d’onboarding (hors copy / atterrissage).
- Redesign de **Découvrir** (`places-map`) — on **réutilise** ses briques.
- Tarifs, offre Lieu, « vous gérez un lieu ».
- Nouvelle porte de fonction (comportement pour tous les comptes sans lieu).
- Refonte Messages sans lieu (si trou constaté : chantier séparé).

## Structure UI — Accueil Explorer Mandala

Ordre vertical (mobile-first) :

1. **Bandeau identité**  
   - Eyebrow / titre : **Explorer Mandala** (plus « Sans lieu » en titre).  
   - Une phrase : le réseau est là ; rejoindre un lieu ouvre la vie du quotidien (mur du lieu, agenda, membres…).  
   - Si barre lieu / chrome : libellé aligné (**Explorer** ou **Explorer Mandala**), pas « Sans lieu » comme seul signal.

2. **Bandeau d’étapes (touche B)** — court, non bloquant, 2–3 puces max :  
   - **Rejoindre un lieu** (primaire, ouvre le flux join existant / `CommunitySwitcher`).  
   - **Compléter ma fiche** (si fiche « vide » — voir § Fiche).  
   - Optionnel tertiaire : **Annuaire** (lien discret, pas une 3ᵉ carte égale au primaire).

3. **Réseau vivant** — réutiliser `WallDiscoverSection` (ou wrapper mince) :  
   - Carte + fil public (annonces / événements / brèves visibles hors appartenance).  
   - Carrousel / liste de lieux comme sur la landing.  
   - `feedLimit` raisonnable (ex. 12–20), hauteur carte adaptée app (pas forcément hero landing).

4. **Pas** de section tarifs / CTA gestionnaire sur cet accueil.

## CTA Rejoindre sur fiche lieu

Sur les cartes lieu affichées depuis cet accueil (et idéalement le même composant ailleurs quand la personne n’est pas membre) :

- Bouton / lien **Rejoindre** clairement visible (pas seulement « voir le profil » ou Relier).  
- Action : même flux que aujourd’hui (`joinCommunity` / switcher / code si `invite`).  
- Si déjà membre d’autres lieux : hors scope de ce chantier (cette page = 0 lieu).  
- Relier reste derrière sa porte ; **Rejoindre** n’est pas Relier.

## Fiche — rappel discret (règle 1 verrouillée)

**Afficher le rappel** tant que la personne **n’apparaît pas** dans l’annuaire Mandala :

```text
needsNudge = scope !== 'mandala'  OR  !hasContent
hasContent = tags.length > 0  OR  offer_text.trim()  OR  seek_text.trim()
```

Aligné sur `hasContent` / `nowVisible` dans `db-skills` (sans lieu, la seule portée d’annuaire est `mandala`).

| Situation | Rappel |
| --- | --- |
| Compte neuf (`hidden`, vide) | oui |
| Contenu écrit, portée encore `hidden` / `places` | oui |
| `mandala` + contenu | non |
| `mandala` sans contenu | oui |

**UI** : une ligne ou petite carte sous le bandeau d’étapes :

> Complétez votre fiche pour apparaître dans l’annuaire.

CTA → Compte / compétences (`ACCOUNT_SKILLS_ANCHOR`).  
Dismiss session (`sessionStorage`) — une invitation, pas de quiz / pas de barre de %.

## Onboarding → atterrissage

Après « Continuer sans lieu » :

1. `continueWithoutPlace` comme aujourd’hui.  
2. `phase = ready` → enfants de `OnboardingGate` = app.  
3. Page initiale = **home** (déjà le cas) qui affiche désormais **Explorer Mandala** enrichi.  

Aucun écran intermédiaire vide. Si un flash « Sans lieu » 3 boutons existait, il est **remplacé** par cette composition.

## Copy (direction)

| Avant | Après |
| --- | --- |
| Sans lieu | Explorer Mandala |
| Votre espace | Explorer Mandala (ou sous-titre « Votre espace sur le réseau ») |
| Les personnes visibles… (carte égale) | Secondaire ; primaire = rejoindre + mur |

Ton : invitation, pas déficit. « Vous pourrez rejoindre un lieu quand vous voulez » déjà présent à l’onboarding — le réaffirmer sans dramatiser.

## Fichiers touchés (prévision)

- `next/src/views/HomePage.tsx` — branche `!active` → composition Explorer  
- évent. `next/src/components/home/ExploreMandalaHome.tsx` (extrait si `HomePage` grossit)  
- `next/src/components/wall/WallDiscoverSection.tsx` / `PlacePublicCard.tsx` — CTA Rejoindre si besoin  
- `next/src/components/layout/ActivePlaceBar.tsx` (+ nav labels si « Sans lieu » y figure)  
- `next/src/lib/nav.ts` / copy explain-cards si libellés solo  
- Tests légers si logique « fiche vide » extraite

## Vérification

- [ ] Compte 0 lieu : Accueil montre **Explorer Mandala** + mur/carte + CTA Rejoindre.  
- [ ] Plus de titre principal « Sans lieu ».  
- [ ] Skip onboarding → directement cet accueil (contenu réseau visible).  
- [ ] Fiche vide : un rappel discret ; dismiss / aller Compte ; pas de quiz.  
- [ ] Fiche déjà remplie / visible : pas de harcèlement rappel.  
- [ ] Carte lieu : **Rejoindre** visible ; join + charte comme aujourd’hui.  
- [ ] Compte avec lieu actif : Accueil lieu **inchangé**.  
- [ ] Découvrir (`places-map`) reste accessible et cohérent (pas de double produit contradictoire).  
- [ ] Mobile : bottom nav solo inchangée (Accueil / Annuaire / Messages / Alertes / Compte).

## Critère de succès

En 10 secondes sur Accueil sans lieu, on **voit le réseau** et on **sait comment rejoindre un lieu** — sans avoir l’impression d’être dans une impasse.
