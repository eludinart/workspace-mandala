# Design — Demande Mandala Pro (avant paiement)

Date : 2026-11-05  
Statut : accepted · spec produit  
Lié : `2026-11-05-annuaire-professionnels-design.md`

## Objectif

Remplacer « payer puis endosser » par **candidature → validation → paiement**.  
Badge + présence **Mandala Pro** (annuaire Pro / carte) seulement après **validation + abo actif**.

## Flux (ordre imposé)

1. **Compte Mandala** déjà créé (inscription plateforme ≠ demande Pro).
2. **Formulaire de demande Pro** (brouillon OK ; soumission → `pending`).
3. **Revue** : équipe Mandala (admin) et/ou gestionnaire d’un lieu dont le candidat est membre.
4. Décision :
   - **Approuvé** → `approved_unpaid` → CTA paiement Stripe/Play débloqué.
   - **Refusé** → `rejected` + motif ; pas de paiement.
5. **Paiement** seulement après approbation → abo `active` → entitlements Pro + **badge** + **visibilité Mandala Pro / carte**.
6. Approuvé mais non payé : pas de boost public ; rappel soft « finaliser l’abonnement ».

Hors scope immédiat : hold / pré-autorisation Stripe.

## Champs du formulaire

| Champ | Obligatoire | Notes |
| --- | --- | --- |
| Accroche / pratique | oui | court, public après validation |
| Modalités | oui | présentiel, visio, ateliers… |
| **Pièce d’identité** | oui | upload ; **privé**, revue admin seulement |
| **Justificatif d’activité** | oui | SIRET, attestation, diplôme… ; **privé** |
| **Portfolio** | oui | liens et/ou fichiers |
| **Responsabilité civile** | **non** | attestation si dispo ; demandée, **non bloquante** |
| **Ville de résidence** | oui | où la personne vit — **distinct** des lieux d’exercice |
| **Lieux d’exercice** | oui (≥ 1) | **liste** ; alimente carte + matching (voir annuaire) |
| **Rayon de déplacement (km)** | oui | zone d’intervention autour des lieux d’exercice |
| Lien externe | optionnel | site / réseaux |
| Attache lieu Mandala | si membre | signal communauté distinct (carte + fiches) |

Statuts : `none` → `pending` → `approved_unpaid` | `rejected` → (après paiement) `verified` + abo actif.

## Carte & matching (alignement annuaire)

- Carte publique = **villes d’exercice** (pas la résidence seule).
- Matching clients ↔ pros = **lieux d’exercice** (+ rayon).
- Candidats `pending` / `approved_unpaid` : **pas** sur la carte / annuaire Pro.
- Attache **lieu Mandala** : pastille distincte du marqueur d’exercice.

## Règles produit

- Pas de checkout Pro tant que la demande n’est pas **approuvée**.
- Refus → aucun prélèvement ; resoumission selon politique (délai / corrections).
- RC absente ≠ refus auto.
- Identité / justificatifs : admin (et revue lieu si conservée) ; jamais publics.

## Critères d’acceptation

- [ ] Offres Pro : formulaire **avant** boutons mensuel/annuel ; checkout seulement si `approved_unpaid`.
- [ ] Soumission → file admin (+ gestionnaire lieu) avec pièces consultables.
- [ ] Approve → paiement possible ; Reject → motif, pas de checkout.
- [ ] Après paiement → badge + marqueurs lieux d’exercice + rayon.
- [ ] RC optionnelle : soumission OK sans fichier RC.
- [ ] Résidence renseignée sans être listée en exercice → **pas** de point carte exercice.

## Suite (hors cette spec)

Stockage fichiers privés, rétention RGPD, copy « pourquoi on demande ça », rappel J+N si approuvé non payé.
