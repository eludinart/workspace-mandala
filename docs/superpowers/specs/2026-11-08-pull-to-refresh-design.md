# Design — Pull-to-refresh mobile

**Date :** 2026-11-08  
**Statut :** design validé (approche 1) — en attente d’implémentation

## Problème

Sur smartphone (PWA / navigateur), il n’y a pas de geste familier pour rafraîchir l’écran courant. Le shell fixe `overflow: hidden` + `overscroll-behavior: none` désactive déjà le pull-to-refresh natif du navigateur (volontairement, pour le chrome iOS / bottom nav). Les utilisateurs s’attendent au geste classique des apps : tirer vers le bas en haut de page.

## Décisions produit

| Choix | Décision |
| --- | --- |
| Geste | Pull-to-refresh classique (tirer vers le bas, `scrollTop === 0`) |
| Effet | Hybride C : soft refetch sur écrans « chauds », hard reload ailleurs |
| Messages | Inclus (liste + fil ouvert) |
| Desktop | Désactivé (`md+` / pas de coarse pointer) |

## Approche retenue

**Hook + composant custom** (`usePullToRefresh` + `PullToRefresh`), sans lib externe.

### Architecture

1. **`PullToRefresh`** enveloppe un conteneur scrollable : rubber-band léger, indicateur (spinner accent) au-dessus du contenu, seuil ~70px.
2. **Branchements**
   - `Layout` : autour du `<main className="… overflow-auto …">` (toutes les pages sauf Messages).
   - `MessagesPage` : sur le conteneur de scroll actif (liste des conversations **ou** fil ouvert).
3. **Détection** : touch / coarse pointer uniquement ; ignore les gestes à dominante horizontale ; ignore si un refresh est déjà en cours.
4. **Dispatch** : fonction `runPullRefresh(page)` (ou registre page → handler) qui choisit soft vs hard.

### Soft vs hard

**Soft** (contenu visible, indicateur discret, pas de flash) :

| Page | Action |
| --- | --- |
| `home`, `events`, `calendar` | Invalidation TanStack Query `placeEvents` (+ refetch communautés si déjà exposé) |
| `place-announcements`, mur / Découvrir | Refetch local des listes |
| `members`, `place-members` | Refetch liste membres |
| `messages` | `loadChannels()` ; si fil ouvert, recharger les messages du canal |
| `notifications` | Refetch alertes |
| `resources`, `skills`, `directory`, `places-map` | Refetch des données de l’écran |

**Hard** (`window.location.reload()`) :

- `admin`, `account`, `place-settings`, `place-profile`, `place-charter`, `place-friends`, `place-invites`, `managed-places`, `billing-offers`, `charter`, `courses`, `logistics`, `circles`, et tout écran sans refetch simple déjà branché.

Règle : si un écran soft n’a pas encore de refetch fiable, **fallback hard** plutôt qu’un no-op silencieux.

### UI

- Indicateur en haut (tiret / spinner aux couleurs accent du thème).
- Pendant soft : listes restent peintes (`isFetching` discret, cohérent avec le design rafraîchissement réactif).
- Relâchement sous le seuil : retour animé, aucun refresh.

### Erreurs

- Soft en échec → toast / message discret « Impossible de rafraîchir » ; pas de reload forcé.
- Hard : comportement navigateur.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Lib (`react-simple-pull-to-refresh`, etc.) | Scroll container concurrent avec Layout / Messages ; style générique ; dépendance |
| Overscroll natif navigateur | Casse le shell PWA déjà calibré (`body` fixed, `overscroll-behavior: none`) ; pas de soft C |

## Critères de succès

1. Accueil / Events / Membres / Annonces : pull → données à jour, pas de flash blanc.
2. Messages (liste + fil) : pull → canaux / messages rafraîchis ; scroll du chat non cassé.
3. Admin / Compte : pull → reload page.
4. Desktop : geste absent.
5. Scroll au milieu d’une liste : pull ne déclenche rien.

## Hors scope

- Lib externe de pull-to-refresh.
- Refresh auto périodique / push-driven.
- Migration TanStack Query des écrans pas encore migrés (hors invalidation déjà possible).
- Modification globale de `overscroll-behavior` sur `html`/`body`.

## Fichiers touchés (indicatif)

- `next/src/hooks/usePullToRefresh.ts` (nouveau)
- `next/src/components/PullToRefresh.tsx` (nouveau)
- `next/src/lib/pull-refresh.ts` (nouveau — mapping soft/hard)
- `next/src/components/layout/Layout.tsx`
- `next/src/views/MessagesPage.tsx`
- Écrans soft : handlers de refetch existants branchés depuis le mapping
