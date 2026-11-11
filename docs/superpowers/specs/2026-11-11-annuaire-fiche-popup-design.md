# Design — Annuaire : fiche personne en popup plein écran

Date : 2026-11-11  
Statut : accepted · implémentation

## Problème

Sur desktop, l’annuaire affiche la fiche sélectionnée dans un **panneau latéral** à côté de la liste. Le panneau est étroit, peu lisible, et force un scroll vertical long. Sur mobile, un overlay plein écran existe déjà et fonctionne mieux.

## Décisions verrouillées

1. **Approche** : étendre le popup mobile actuel à **tous les breakpoints** (option 1).
2. **Présentation** : overlay **plein viewport** (option A) — pas de modale centrée ni de panneau latéral.
3. **Liste** : grille **2 colonnes** (md+) / **3 colonnes** (xl+) une fois le panneau retiré (option B).
4. Contenu de fiche : réutiliser `SkillFicheContent` sans refonte éditoriale.
5. Largeur de lecture dans le popup : contenu borné (~`max-w-2xl` / ~68ch), centré.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Modale centrée large (B) | Risque de re-comprimer les fiches longues |
| Hybride desktop modale / mobile plein écran (C) | Deux comportements pour peu de gain |
| Extraire `SkillFicheOverlay` tout de suite | Surcoût ; possible plus tard si le JSX grossit |
| Naviguer vers `/competences/[id]` | Perd filtres / scroll de l’annuaire |

## Périmètre

### Dans le scope

- `SkillsDirectory` (variantes `app` et `public`) :
  - supprimer l’`<article id="annuaire-fiche">` desktop ;
  - afficher le portail plein écran dès qu’une fiche est sélectionnée (tous breakpoints) ;
  - grille de cartes responsive ;
  - lock scroll body + fermeture Échap + bouton Fermer ;
  - scroll en haut du popup à chaque ouverture ;
  - ouverture depuis carte géo / `initialUserId` inchangée.
- Fiche lieu publique (`PlacePublicProfile`, ex. `/lieux/terre-deveil`) :
  - section **Charte & valeurs** repliée par défaut (aperçu court + CTA « Lire la charte ») ;
  - clic pour déployer / replier — l’annuaire du lieu reste visible sans scroller toute la charte.

### Hors scope

- Refonte de `SkillFicheContent` (sections, copy).
- Page publique `/competences/[userId]`.
- Redesign carte géo, filtres, nuage de tags.
- Écran d’acceptation de charte à l’onboarding (reste intégral).

## Structure UI

1. **Annuaire** (page) : header, carte, filtres, puis **grille de cartes** seule.
2. **Popup** (portal `document.body`) :
   - barre : « Fiche » + Fermer ;
   - zone scrollable avec `SkillFicheContent` centré `max-w-2xl` ;
   - fond `slate-950` plein écran (comme mobile aujourd’hui).

## Fichiers touchés

- `next/src/components/skills/SkillsDirectory.tsx` (principal)
- Spec / plan sous `docs/superpowers/`

## Vérification

- [ ] Desktop : clic carte → popup plein écran lisible ; Fermer / Échap ferment ; grille intacte.
- [ ] Mobile : même flux qu’avant (pas de régression).
- [ ] Grille 1 / 2 / 3 colonnes selon largeur.
- [ ] Pin carte ouvre le même popup.
- [ ] `initialUserId` ouvre le popup au chargement.

## Critère de succès

En un clic sur une fiche, on lit confortablement sur tout l’écran — plus de colonne étroite illisible à côté de la liste.
