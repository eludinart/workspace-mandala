# Design — Annuaire Mandala (double vision)

Date : 2026-11-05  
Statut : accepted · squelette en cours  
Nom de page (provisoire UI) : **Annuaire** — la vue réservée s’appelle **Mandala Pro** (à revoir plus tard si besoin).

## Problème

La page « Compétences / compétences du réseau » est un carrousel léger de fiches skills. Elle ne porte pas un vrai annuaire, ni la distinction claire entre **pros validés** et **membres**, ni une géo basée sur les **lieux d’exercice**.

## Décision — double vision (A)

### A1. Vue **Mandala Pro**
Annuaire **réservé aux professionnels validés** uniquement (`pro_verified` + abo selon entitlements).  
Flux candidature : voir `2026-11-05-demande-mandala-pro-design.md` (formulaire **avant** paiement).

### A2. Vue **Annuaire global Mandala**
Mélange **pros + non-pros**, avec filtre :
- **Tous**
- **Pros** (validés)
- **Membres** (sans badge Pro)

### A3. À l’intérieur de **chaque lieu Mandala**
Même double vision : pros + non-pros du lieu ; filtre Tous / Pros / Membres. Pas d’annuaire lieu « skills only » séparé du modèle global.

## Carte — villes d’exercice (B)

- La carte montre les **villes où les gens exercent** (pros **et** non-pros).
- Le **matching** clients ↔ personnes utilise les **lieux d’exercice**, pas la résidence.
- La résidence seule **ne place pas** quelqu’un sur la carte d’exercice.

### Pattern carte retenu (benchmark Doctolib / PagesJaunes / Malt)

**Cascade pins + clusters** (éviter spider-lines) :
1. Zoom large → **clusters par ville d’exercice** (« Tours · 12 »).
2. Zoom proche → **1 pin par (personne × ville d’exercice)** — une personne multi-villes = N pins (pattern Doctolib « une apparition par adresse »).
3. Clic pin → fiche + chips « exerce aussi à… ».
4. **Lieux Mandala** = couche / pictogramme **distinct** (pas un pin d’exercice).
5. Phase ultérieure Pros : disques de **rayon** (pattern Malt) en plus des pins — pas dans le squelette.

Implémentation technique : réutiliser Leaflet (`PlacesMap`) ; monter `AnnuaireCitiesMap` dans `#annuaire-carte` (`PublicSkillsPage`), pas enterré dans `SkillsDirectory`. Geo aujourd’hui = surtout communautés ; `practice_locations` + geocode (Nominatim) à ajouter.

## Attache à un lieu Mandala (C)

Si une personne est **liée à un lieu Mandala** (communauté) :
- l’attache doit être **visuellement distincte** de la ville d’exercice ;
- affichée sur la **carte** (symbole / pastille / lien lieu) **et** sur les **cartes annuaire / fiche profil**.

| Signal | Signifie |
| --- | --- |
| Marqueur / libellé **ville d’exercice** | Où la personne pratique |
| Pastille / lien **lieu Mandala** | Appartenance à une communauté |

Ne pas fusionner les deux dans un seul picto.

## Champs profil — pro et non-pro (D)

| Champ | Cardinalité | Rôle |
| --- | --- | --- |
| **Ville de résidence** | 1 | Où la personne vit — **distinct** ; hors carte d’exercice sauf si aussi listée en exercice |
| **Lieux d’exercice** | **liste** (N) | Où elle pratique ; chaque entrée alimente carte + matching |

Règles :
1. Résidence ≠ exercice (séparés en UI et en données).
2. Une ville n’apparaît sur la carte d’exercice que si elle est dans **Lieux d’exercice**.
3. Les champs s’appliquent aux **pros et aux membres** (annuaire global + lieux).

## Structure page (cible)

1. Hero **Annuaire** + bascule **Tout Mandala | Mandala Pro** (ou filtre équivalent).
2. Filtres **Tous / Pros / Membres** + recherche pratique + (plus tard) ville / rayon sur lieux d’exercice.
3. Carrousel « À la une » (Pros) — abouti, secondaire.
4. Grille / liste de cartes : badge Pro si validé ; pastille **lieu Mandala** si attaché ; libellés lieux d’exercice.
5. Toggle **Liste | Carte** : marqueurs = villes d’exercice ; attache lieu Mandala en signal distinct.

## Demande Mandala Pro (rappel)

Détail : `docs/superpowers/specs/2026-11-05-demande-mandala-pro-design.md`.  
Court : formulaire → validation équipe → paiement → badge + présence Pro. Zone / carte Pro s’appuient sur les **lieux d’exercice** (+ rayon d’intervention côté demande Pro).

## Écart vs existant

| Avant | Après |
| --- | --- |
| Titre Compétences du réseau | **Annuaire** (+ vue Mandala Pro) |
| Checkbox Pro enterrée | Filtres **Tous / Pros / Membres** visibles |
| Slideshow = principal | Slideshow = à la une ; liste = cœur |
| Pas de géo claire | Carte = **villes d’exercice** ; matching idem |
| Pas d’attache lieu visuelle | Pastille lieu Mandala ≠ ville d’exercice |
| Résidence seule (implicite) | Résidence + **liste** lieux d’exercice |

## Hors scope immédiat
Prise de RDV, avis clients, hold Stripe, renommage URL forcé (`/professionnels`).

## Implémentation — tranches

- **Tranche 1 (en cours)** : squelette page + filtres audience Tous/Pros/Membres.
- **Tranche 2** : champs profil (résidence + lieux d’exercice) + API.
- **Tranche 3** : couche carte (marqueurs exercice) + signal attache lieu Mandala (carte + cartes fiche).
