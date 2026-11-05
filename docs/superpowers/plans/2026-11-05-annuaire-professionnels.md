# Annuaire professionnels — Plan

**Goal:** Annuaire double vision (Mandala Pro / global / lieux) avec filtres, champs profil résidence + lieux d’exercice, carte des villes d’exercice, signal d’attache lieu Mandala.

**Architecture:** Enrichir `SkillsDirectory` + pages publiques / lieu ; profil + API pour géo d’exercice ; couche carte séparée de l’attache communauté. Specs : `2026-11-05-annuaire-professionnels-design.md`, `2026-11-05-demande-mandala-pro-design.md`.

## Task 1 — Specs
- [x] `docs/superpowers/specs/2026-11-05-annuaire-professionnels-design.md` (double vision, carte exercice, attache lieu, champs profil)
- [x] `docs/superpowers/specs/2026-11-05-demande-mandala-pro-design.md` (candidature avant paiement)

## Task 2 — Filtres audience (tranche 1)
- [x] Remplacer `mandalaProOnly` par `audience: all | pro | members`
- [x] Onglets visibles **Tous / Pros / Membres** (pas seulement sous Affiner)
- [x] Même filtre dans l’annuaire **d’un lieu** Mandala (`SkillsDirectory` partagé)
- [x] Titre / copy vue **Mandala Pro** quand `audience === 'pro'`

## Task 3 — Page publique + nav (tranche 1)
- [x] `PublicSkillsPage` + metadata `/competences` → Annuaire
- [x] Label nav **Annuaire** (+ slot `#annuaire-carte` placeholder)
- [ ] Label `nav` `skills: 'Compétences'` → `Annuaire` (reste éventuel)
- [ ] Copy hero + structure liste / à la une (affinage Resalib — itératif)

## Task 4 — Champs profil + API (tranche 2)
- [x] Modèle : `residence_city` + `practice_locations_json` sur `mandala_skill_profiles`
- [x] API `/api/skills/profile` + `skillsApi` + seed à l’inscription
- [x] Formulaires : Compte / fiche compétences / Login register / demande Pro
- [x] Cartes annuaire : pastille Lieu Mandala vs « Exerce · … »
- [ ] Géocodage des villes d’exercice (tranche carte)

## Task 5 — Couche carte villes d’exercice (tranche 3)
- [ ] Composant `AnnuaireCitiesMap` (Leaflet, `ssr: false`) branché sur `#annuaire-carte`
- [ ] Zoom large = clusters ville ; zoom proche = pin (personne × ville d’exercice)
- [ ] Matching / recherche géo branchés sur lieux d’exercice
- [ ] Toggle Liste | Carte sur annuaire global (puis lieu)
- [ ] (Plus tard) rayons km Pro — hors squelette

## Task 6 — Signal attache lieu Mandala (tranche 3)
- [ ] Pastille / lien communauté **distinct** du marqueur ville d’exercice
- [ ] Visible sur **carte** et sur **cartes annuaire / profil**
- [ ] Ne pas confondre « membre du lieu X » et « exerce à Y »

## Critères done (global)
- [ ] Filtres Tous/Pros/Membres OK global + par lieu
- [ ] Mandala Pro = validés only
- [ ] Carte et matching = exercice, pas résidence seule
- [ ] Attache lieu Mandala lisible et distincte
