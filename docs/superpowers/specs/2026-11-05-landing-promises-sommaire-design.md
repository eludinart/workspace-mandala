# Design — Landing « trois promesses » en sommaire éditorial

Date : 2026-11-05  
Statut : accepted · implémentation  
Section : `#projet` · `LandingPromisesSection`

## Problème

Les trois blocs ressemblent à des cards SaaS (fond blanc, ombre, CTA uppercase) — hors charte Mandala.

## Décision

**Approche 1 — sommaire de livre**, validée. Garder le clic qui déplie le détail.

## UI

1. **Plus de cards** sur les déclencheurs ni sur le panneau détail (pas de blanc / ombre / bordure lourde).
2. **Trois entrées** : numéro romain (accent wine) · titre Cormorant · teaser · libellé discret « Détail » / « Fermer ».
3. Desktop : 3 colonnes texte nu, séparées par un filet vertical léger (ou gap + filet). Mobile : pile + filets horizontaux.
4. **Panneau détail** plein largeur sous le trio : lead + liste simple (puces / tirets, pas de mini-cards) + liens texte.
5. État ouvert : accent wine sur le numéro / titre ; pas de ring violet.
6. Motion légère : fade du détail, teinte numéro au open.

## Hors scope

Copy produit, plafond 40, section `#tarifs`.
