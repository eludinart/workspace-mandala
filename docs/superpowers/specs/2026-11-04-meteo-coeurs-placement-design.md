# Design — Placement de La Météo des Cœurs

Date : 2026-11-04  
Statut : accepted · implémentation

## Problème

Le sélecteur **La Météo des Cœurs** (`HeartWeatherPicker`) est dans **Mon compte → Profil**, entre l’email et la photo. C’est un geste du jour lié au **lieu actif**, pas un réglage d’identité. Le placement casse le flux Profil et enterre un rituel quotidien.

Les badges météo (`WeatherBadge`) s’affichent déjà sur les cartes de la page **Membres**.

## Décision

1. **Ancrage** : sélecteur complet en **bandeau sous le titre** de la page **Membres**, avant la barre de recherche. Retirer entièrement le bloc du Profil.
2. **Invitation discrète** : carte douce sur **Accueil** si aucune météo du jour pour le lieu actif, avec « Plus tard » (session) et disparition dès qu’un choix est posé.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Bloc repliable sur Membres | Moins encombrant, trop facile à oublier pour un rituel du jour |
| Carte sticky « moi » en tête de liste | Plus de cas particuliers (annuaire, mode org) pour peu de gain |
| Compte → Mes communautés | Toujours trop loin du mur où on voit les météos |
| Puce permanente sous le sélecteur de lieu | Plus « chrome », moins invitation du jour |
| Modal une fois par jour à la connexion | Trop interruptif (concurrence push / PWA) |

## Comportement cible — Membres

1. **Où** : `MembersPage`, après le header (titre + sous-titre + Rafraîchir), avant la recherche.
2. **Quand afficher** : uniquement si `active` est défini **et** `!organisationMode` **et** `!directoryMode`.
3. **Quoi** : réutiliser `HeartWeatherPicker` sans changer son API ni son UI interne.
4. **Compte** : retirer l’import et le conteneur météo de `AccountPage` section Profil.
5. **Données / API** : aucun changement (`weatherApi`, `db-weather`, usermeta par communauté).
6. **Badges** : `WeatherBadge` sur les cartes membres reste inchangé.

## Comportement cible — Accueil (invitation)

1. **Où** : `HomePage`, juste sous le hero, avant les raccourcis — uniquement si un lieu est actif.
2. **Quand afficher** : lieu actif **et** aucune météo du jour pour ce lieu **et** pas reportée pour la session (`sessionStorage`).
3. **Quoi** : composant dédié `HeartWeatherHomeCard` — pastilles + note courte optionnelle + « Plus tard ». Ton discret, pas de modal.
4. **Après choix** : enregistre via `weatherApi`, la carte disparaît. Édition ultérieure sur Membres.
5. **Plus tard** : cache pour la session navigateur (même onglet).

## Fichiers touchés

- `next/src/views/MembersPage.tsx` — montage du picker
- `next/src/views/AccountPage.tsx` — retrait
- `next/src/views/HomePage.tsx` — carte douce
- `next/src/components/community/HeartWeatherHomeCard.tsx` — invitation Accueil

Hors scope : redesign du picker Membres, notifications push liées, i18n.

## Vérification

- Sur Membres (lieu actif) : le bandeau apparaît et enregistre la météo du lieu.
- Annuaire global / mode org : pas de bandeau.
- Profil compte : plus de météo entre email et photo.
- Accueil sans météo du jour : carte douce ; après choix ou « Plus tard » : disparaît.
- Accueil avec météo déjà posée : pas de carte.
- Les badges sur les cartes membres restent inchangés.
