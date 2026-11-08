# Design — Rafraîchissement réactif & compréhension lieu

**Date :** 2026-11-08  
**Statut :** approuvé par orientation produit (« au mieux / le plus efficace »)

## Problème

Les données lieu sont en `useState` + fetch local. Switch de lieu incohérent (stale Agora/annonces/calendrier), refetch qui vide l’UI, switch manuel silencieux, bus événements partiel. Pas de cache partagé entre pages.

## Approche retenue

**Hybride efficace** (pas de refonte totale, pas de quick wins seuls) :

1. **TanStack Query** sur le chemin chaud : liste événements (+ elsewhere) partagée Home / Events / invalidation Calendar.
2. **Règle lieu** : jamais peindre les données d’un autre slug (clear / `placeholderData` désactivé au switch).
3. **Feedback** : bannière courte au switch manuel ; `isFetching` discret vs premier chargement ; `refreshCommunities({ background })`.
4. **Bus** : toute création/édition d’événement invalide les queries + émet `mandala-events-changed`.

Hors scope immédiat : migrer Members, Messages, Agora posts vers Query (phase 2) ; Zustand reste pour social unread.

## Critères de succès

- Switch Shambhala → Sivana : aucun contenu/image de Shambhala visible sur Accueil / Events / Agora / Annonces / panneau jour Calendar.
- Refetch après mutation : listes restent visibles avec indicateur discret.
- Utilisateur comprend le lieu actif (barre + bannière switch).
