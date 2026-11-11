# Design — Admin Pilotage drill-down

Date : 2026-11-11  
Statut : accepted · implémentation  
Public : `requireAdmin` uniquement  
Parent : `2026-11-11-admin-pilotage-design.md`

## Objectif

Permettre d’**approfondir** chaque élément du dashboard Pilotage : clic → liste détaillée dans un drawer, puis ouverture des écrans admin existants (fiche personne, lieux, charge, push).

## Décisions

- Approche **A** : drawer + API drill dédiée (pas seulement filtre du fil déjà chargé).
- Portée **tout le dashboard** : KPI, funnel, séries, lieux, fil, alertes, santé serveur/app.
- Pattern **C** : panneau dans Pilotage **et** navigation vers l’existant.

## Interaction

1. Clic sur un élément cliquable → ouvre un **drawer** Pilotage (titre = métrique / contexte, liste paginée, bouton Retour).
2. Clic sur une **ligne personne** du drawer → `AdminUserSheet` (même composant que l’onglet Personnes).
3. Clic sur un **lieu** → bascule onglet Lieux (focus communauté si possible) ou ligne lieu du tableau.
4. Clic sur **santé serveur / push / alerte Charge** → onglet `load` ou `push` (réutilise `href` des alertes existantes).
5. Clic sur une ligne du **fil d’activité** → ouvre directement la fiche user (ou le drawer lieu si l’event est centré lieu sans user).

Éléments non cliquables : texte d’aide, labels de légende, boutons Export / Rafraîchir / sélecteur 7|30|90.

## Mapping clic → contenu

| Surface | Paramètres drill | Contenu drawer |
| --- | --- | --- |
| KPI Comptes | `kind=total_users` | Liste récente des comptes (tri `user_registered` desc) |
| KPI Inscriptions | `kind=registrations` | Inscrits sur la période |
| KPI Joins | `kind=joins` | Joins (user + lieu) sur la période |
| KPI Sans lieu | `kind=continue_without_place` | Users avec meta continue sans lieu |
| KPI Actifs 24 h | `kind=active_24h` | Users `mdl_social_last_seen_at` &lt; 24 h |
| KPI DAU / WAU / MAU | `kind=dau\|wau\|mau` | Users session_days (jour / 7 j / 30 j) |
| Funnel étapes | `kind=funnel_registered\|funnel_place\|funnel_no_place\|funnel_d1\|funnel_d7` | Cohorte inscrits période filtrée |
| Série (jour) | `kind=series_day&metric=registrations\|joins\|dau&day=YYYY-MM-DD` | Items de ce jour |
| Ligne lieu | `kind=place&community_id=` | Membres + joins/départs 30 j (sections ou tabs légers) |
| Alerte produit | `kind=alert&alert_id=` | Liste liée (ex. lieux stagnants, inscrits sans join) |
| Santé RPS / erreurs / pool | — | Navigate `adminTab=load` |
| Push delivery | — | Navigate `adminTab=push` |

## API

`GET /api/admin/pilotage/drill`

Query :

- `kind` (requis) — voir table ci-dessus
- `days` — `7|30|90` (défaut 7), pour les cohortes période
- `day` — jour civil Paris `YYYY-MM-DD` (séries)
- `metric` — `registrations|joins|dau` (séries)
- `community_id` — lieu
- `alert_id` — id alerte produit
- `cursor` — pagination opaque (offset ou id), défaut 0
- `limit` — défaut 50, max 100

Réponse :

```json
{
  "ok": true,
  "title": "Inscriptions (7 j)",
  "kind": "registrations",
  "items": [
    {
      "user_id": 12,
      "label": "Alice",
      "at": "2026-11-10 14:02:00",
      "community_id": null,
      "community_name": null,
      "meta": null
    }
  ],
  "next_cursor": "50"
}
```

Auth : `requireAdmin`. Erreurs : 400 kind inconnu, 404 lieu, 500 DB.

Export CSV du drawer : hors scope v1 (le dashboard garde les exports séries/fil).

## UI

- Composant `AdminPilotageDrillDrawer` (ou section dans `AdminPilotageTab`).
- Desktop : panneau ~420px à droite ou overlay bas ; mobile : plein écran.
- Cartes KPI / cellules funnel / lignes : `button` ou `role=button`, focus visible, curseur pointer.
- État loading / erreur / vide dans le drawer.
- `AdminUserSheet` monté depuis Pilotage quand `selectedUserId` est défini (ne pas exiger de quitter l’onglet).

Navigation admin : callbacks `onOpenLoad`, `onOpenPush`, `onOpenPlaces(communityId?)` passés par `AdminPage`, ou `window`/URL `?page=admin&adminTab=…` déjà supportée.

### Séries journalières — lisibilité (bug UX actuel)

Problème constaté : avec des compteurs à 0, seules les dates apparaissent ; la légende « Vert / Bleu / Violet » ne dit pas **ce que c’est**, et les barres sont invisibles.

À corriger dans la même livraison :

1. **Sous-titre** sous le titre : ex. « Inscriptions, rejoindre un lieu (joins) et visiteurs uniques (DAU) par jour civil Paris ».
2. **Chiffres par jour** toujours visibles : `11-11 · I 0 · J 0 · D 0` (ou pastilles colorées + nombres), même à zéro.
3. Barres : garder un trait minimal seulement si `> 0` ; ne pas laisser une ligne vide trompeuse.
4. Légende avec pastilles couleur réelles + libellés complets (pas seulement « Vert = … »).
5. Chaque ligne jour cliquable → drawer (choix métrique ou onglets I/J/D dans le drawer).
6. Si toute la période est à zéro : message explicite « Aucune activité mesurée sur ces jours — les compteurs monteront avec les inscriptions, joins et sessions. »

## Hors scope

- Deep-link URL partageable du drawer (`&drill=…`) — possible plus tard
- Metabase / FullStory / Telegram
- Édition inline depuis le drawer

## Critères de succès

- Chaque KPI, étape funnel, jour de série (3 métriques), ligne lieu, ligne fil, alerte produit, et tuiles santé sont actionnables.
- Une liste réelle (pas un simple scroll du fil) s’affiche pour les kinds user/lieu.
- Depuis une ligne user on ouvre la fiche admin existante sans perdre le contexte Pilotage (fermer la sheet revient au drawer ou au dashboard).
