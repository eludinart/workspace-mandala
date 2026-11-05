# Design — Parc d’abonnements (admin)

Date : 2026-11-05  
Statut : accepted · implémentation

## Problème

L’onglet Admin → **Abonnements** n’expose que le cadeau Lieu et la file d’endossement Pro. Aucune vue du parc (actifs + à risque).

## Décision

1. Panneau **Parc d’abonnements** en tête de l’onglet (avant Cadeau / Endosser).
2. Source : `GET /api/admin/billing/subscriptions` (admin only) + `listAdminBillingSubscriptions` dans `db-billing`.
3. Périmètre : Lieu + Pro ; statuts `active`/`trialing` encore ouverts (y compris grâce cadeau Lieu) + `past_due`/`unpaid`.
4. Filtre famille + tri (fin de période, famille, statut ops, cible, provider).
5. Raccourcis : ouvrir personne / lieu ; prolonger cadeau Lieu via l’API comp existante. Pas d’annulation Stripe ni de forçage de statut.

## Colonnes

Cible · famille/plan · statut ops (`actif` / `bientôt` / `grâce` / `impayé`) · provider · fin de période · résiliation fin de période · actions.

## Phases

- **A (livré)** : parc actifs + à risque, filtre/tri, raccourcis ouvrir / prolonger cadeau.
- **B (en cours)** : historique récent (annulé / expiré / hors grâce), filtre de portée `actifs | historique | tout`, sans gestion Stripe destructive.
- **C (plus tard)** : export CSV, annulation / forçage statut (gestion complète).

## Hors scope (phase C+)

Export CSV, gestion Stripe complète (annuler, forcer statut).
