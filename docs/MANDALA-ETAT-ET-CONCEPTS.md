# Mandala — État d’évolution et concepts (contexte Gemini)

> **Usage** : importer ce fichier dans Gemini (ou autre LLM) pour travailler sur la vision produit, l’architecture, les évolutions futures ou la rédaction de specs.  
> **Dernière mise à jour** : mai 2026 · **Repo** : `eludinart/workspace-mandala` · **Prod** : `https://mandala.eludein.art` (Coolify)

---

## 1. Résumé exécutif

**Mandala** est une plateforme web **multi-communautés** dédiée à la vie associative / spirituelle de lieux comme **Shambhala** et **Sivanà**. Elle permet de gérer **membres**, **événements**, **messagerie relationnelle** (métaphore du jardin) et **administration**.

L’application est extraite du socle technique de **Fleur d’AmOurs** (autre projet du même auteur) : auth JWT, MariaDB, patterns API Next.js — mais **sans** les modules IA, tarot, billing, etc.

**État actuel** : bêta fonctionnelle en production sur **Coolify** (Dockerfile, Next.js 15 standalone, MariaDB dédiée, préfixe tables `mdl_`). Développement local via tunnel SSH vers MariaDB VPS (`npm run dev.vps`, port **3002**).

---

## 2. Vision produit

### 2.1 Problème adressé

Des communautés dispersées ont besoin d’un **espace numérique commun** par lieu :
- voir qui est membre et comment le contacter ;
- organiser des **événements** (préparation → jour J → après → clôture) ;
- entretenir des **liens** entre personnes (demandes d’amitié symbolisées, puis dialogue privé) ;
- recevoir des **annonces** et notifications de la part des organisateurs / admins.

### 2.2 Principes UX

- **Une communauté active à la fois** (sélecteur Shambhala / Sivanà / autres) — le contenu (événements, membres filtrés) dépend de ce choix.
- Navigation **mobile-first** : barre du bas (Accueil, Événements, Membres, Messages) + pages secondaires (Alertes, Compte, Admin).
- Vocabulaire **poétique / jardin** hérité de Fleur d’AmOurs (voir glossaire §3).
- Interface sombre (slate / violet / ambre selon communauté).

### 2.3 Communautés seed

| Slug | Nom | Rôle symbolique |
|------|-----|-----------------|
| `shambhala` | Shambhala | Lieu cœur — Inde |
| `sivana` | Sivanà | Communauté Sivanà |

D’autres communautés peuvent être **créées** (catalogue + adhésion) ; les admins peuvent les **éditer** (profil enrichi).

---

## 3. Glossaire des concepts (domaine métier)

Ces termes structurent le langage produit et le code. Gemini doit les utiliser tels quels pour rester cohérent avec l’équipe et le code existant.

| Concept | Signification | Implémentation technique |
|---------|---------------|---------------------------|
| **Communauté** | Espace collectif (lieu, groupe) | Table `mdl_mandala_communities`, membership `mdl_mandala_community_members` |
| **Membre** | Utilisateur rattaché à une communauté | Rôles : `member`, `organizer`, `admin` (communauté) |
| **Admin applicatif** | Super-utilisateur global | `app_role=admin`, ou e-mail dans `MANDALA_ADMIN_EMAILS`, ou `wp_role=administrator` |
| **Prairie** | Réseau de liens confirmés entre personnes | Table `mdl_prairie_links` ; API `/api/prairie/*` |
| **Fleur** | Représentation d’un membre dans la prairie (liste visuelle) | `db-prairie.ts`, `/api/prairie/fleurs`, `/api/members/fleurs` |
| **Graine** | Demande de connexion / intention envoyée à quelqu’un | Table `mdl_social_seeds`, statuts `pending` / accepté / refusé |
| **Intention** | Motif de la graine (résonance, amitié, etc.) | IDs : `resonance`, `eclairage`, `ludus`, `philia`, `agape` |
| **Lisière** | Visite du profil public d’un autre membre | API `visit_lisiere` — relation, graines en attente |
| **La Clairière** | Messagerie P2P (dialogues) après lien établi | Canaux `mdl_chat_channels` + messages ; UI `MessagesPage`, `DialogueStream` |
| **Température** | Indicateur d’ambiance d’un canal (`calm`, etc.) | Champ `temperature` sur messages ; `TemperatureIndicator` |
| **Événement** | Rassemblement planifié dans une communauté | Tables `mdl_events`, staff, tâches, médias |
| **Phase événement** | Cycle de vie | `preparation` → `day` → `after` → `closed` |
| **Staff** | Équipe d’un événement | Rôles : `lead`, `welcome`, `logistics`, `communication`, `volunteer` |
| **Broadcast** | Campagne de communication admin (email + in-app) | `db-broadcasts.ts`, API `/api/admin/broadcasts/*` |
| **Télémétrie** | Journal d’événements techniques côté client | `TelemetryTracker`, table télémétrie, onglet Admin « Technique » |
| **Acting role** | Prévisualisation UI admin/coach/user | `sessionStorage` clé `mdl_admin_acting_role` — n’altère pas les droits serveur |

---

## 4. Architecture technique

### 4.1 Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Next.js 15 App Router, client components, Zustand (`useSocialStore`) |
| Backend | Routes API Next.js (`next/src/app/api/**/route.ts`) |
| Base | MariaDB, pool `mysql2`, préfixe configurable `DB_PREFIX` (défaut `mdl_`) |
| Auth | JWT (cookie httpOnly + refresh), tables style WordPress `users` / `usermeta` |
| Déploiement | Docker multi-stage (`Dockerfile` / `Dockerfile.next`), Coolify, Traefik, Let’s Encrypt |
| Héritage | Patterns portés depuis Fleur d’AmOurs (`c:\workspace`) |

### 4.2 Structure du dépôt

```
workspace-mandala/
  next/                    # Application Next.js
    src/
      app/api/             # ~58 routes REST
      views/               # Pages métier (Home, Events, Members, Messages, Admin…)
      components/          # UI (layout, social, admin, avatars)
      contexts/            # Auth, Community, Notifications
      lib/                 # db-*, auth, api-client, middleware
      api/                 # Clients fetch typés (auth, events, social…)
      store/               # Zustand social
  docs/
    schema/                # Migrations SQL 001 → 007
    *.md                   # Guides déploiement, ce fichier
  scripts/
    apply-all-schemas.mjs  # Applique docs/schema/*.sql
    grant-admin.mjs        # Promouvoir un e-mail en admin
    docker-entrypoint.sh
  Dockerfile, Dockerfile.next
```

### 4.3 Modèle de données (tables principales)

Préfixe exemple : `mdl_`.

| Fichier SQL | Domaine |
|-------------|---------|
| `001_mandala_core.sql` | Communautés, membres communauté |
| `002_mandala_auth.sql` | `users`, `usermeta`, `mandala_app_roles` |
| `003_mandala_social.sql` | Chat, graines, prairie, notifications |
| `004_mandala_events.sql` | Événements, staff, tâches |
| `005_mandala_events_media.sql` | Médias événement (cover, galerie) |
| `006_notifications_v2_columns.sql` | Colonnes notifications v2 |
| `007_mandala_communities_profile.sql` | Profil communauté (avatar, description, lieu, site, contact) |

Les modules `db-*.ts` créent aussi certaines tables **au runtime** si absentes (`ensure*Tables`).

### 4.4 Authentification et rôles

- **Inscription / login** : `/api/auth/register`, `/api/auth/login`, cookie JWT.
- **Profil** : pseudo, nom, visibilité, **avatar** (image compressée base64 ou emoji « graine »), bio.
- **Rôle communauté** : par ligne dans `mandala_community_members` (`member` | `organizer` | `admin`).
- **Rôle app** : `mandala_app_roles.app_role` — `user` ou `admin`.
- **Bootstrap admin** : variable serveur `MANDALA_ADMIN_EMAILS` (liste e-mails) + script `grant-admin.mjs`.

### 4.5 Multi-communautés (flux)

1. Utilisateur connecté → `GET /api/communities/mine` → liste avec rôle par communauté.
2. `CommunityContext` stocke la communauté active (`localStorage` : `mandala_active_community`).
3. Toutes les vues filtrées utilisent `active.slug` ou `active.id`.
4. **Rejoindre** : `POST /api/communities/join` ; **créer** : `POST /api/communities/create` (selon droits).
5. **Admin communautés** : CRUD `/api/admin/communities`, gestion membres `/api/admin/communities/[id]/members`.

### 4.6 Parcours utilisateur type

```
Login → Accueil (aperçu événements + alertes)
  → Membres : annuaire communauté, envoyer une Graine 🌱
  → Messages : Graines reçues (accepter/refuser) → La Clairière (canaux P2P)
  → Événements : liste → détail (phase, tâches, équipe, médias)
  → Compte : photo, bio, emoji avatar
  → Alertes : centre de notifications
  → Admin (si droits) : personnes, communications, technique, onglet Communautés
```

### 4.7 API — inventaire par domaine

**Auth** : `login`, `logout`, `register`, `me`, `refresh`, `users`, `users/update`  
**Communautés** : `list`, `mine`, `join`, `create`, `catalog`  
**Membres** : `directory`, `community`, `fleurs`  
**Prairie** : `fleurs`, `add-link`, `remove-link`, `arroser`, `pollen`, `check-visibility`  
**Social** : `send_seed`, `accept_connection`, `reject_connection`, `pending_seeds_incoming`, `my_channels`, `channel_messages`, `send_message`, `mark_channel_read`, `visit_lisiere`, `presence_heartbeat`, `clairiere_unread_count`  
**Événements** : CRUD `events`, `events/[id]`, `staff`, `tasks`, `media`, `members`  
**Notifications** : `list`, `create`, `mark_read`, `mark_all_read`, `unread_count`, `admin_list`, `admin_delete`  
**Admin** : `communities`, `communities/[id]`, `members`, `broadcasts/*`  
**Télémétrie** : `event`, `events`  
**Santé** : `health`, `health/live` (sonde Docker)

---

## 5. Modules — état d’implémentation (mai 2026)

Légende : ✅ livré · 🟡 partiel · ⬜ prévu / legacy doc obsolète

| Module | Fonctionnalités | Statut |
|--------|-----------------|--------|
| Auth | Inscription, login, JWT, profil, avatar | ✅ |
| Communautés | Sélecteur, join, catalogue, profil enrichi (avatar, description, lieu, site, contact) | ✅ |
| Communautés admin | CRUD, membres, bannière « espace administré » | ✅ |
| Membres | Annuaire par communauté, carte « Moi », graines vers autrui | ✅ |
| Messages | Graines entrantes (accepter/refuser), La Clairière, non-lus, présence | ✅ |
| Événements | Liste, détail, phases, tâches par phase, staff, médias (cover/galerie) | ✅ |
| Notifications | Centre utilisateur, création admin, compteurs non-lus | ✅ |
| Broadcasts | Création, preview audience, enqueue (admin) | ✅ |
| Compte | Photo, bio, emoji graine avatar | ✅ |
| Admin | Personnes, annonces, diffusions, télémétrie, communautés, acting role | ✅ |
| Push FCM | Priming UI, infra `fcm.ts` | 🟡 (pas mobile natif Capacitor) |
| E-mail SMTP | Campagnes broadcast | 🟡 (dépend config serveur) |
| HTTPS prod | Redirection HTTP→HTTPS, HSTS, CSP upgrade-insecure-requests | ✅ (activer **Force HTTPS** dans Coolify) |

> **Note** : `docs/CAHIER-DES-CHARGES.md` est **partiellement obsolète** (marque encore « À faire » pour graines, notifications, mur) — l’implémentation actuelle les couvre.

---

## 6. Interface — pages et composants clés

| Page (`MandalaPage`) | Fichier | Rôle |
|----------------------|---------|------|
| `home` | `HomePage.tsx` | Hub : prochains événements, raccourcis, alertes récentes |
| `events` | `EventsPage.tsx`, `EventDetailPage.tsx` | Liste + détail événement |
| `members` | `MembersPage.tsx` | Annuaire, graines, lien vers messages |
| `messages` | `MessagesPage.tsx` | Graines + Clairière |
| `notifications` | `NotificationsPage.tsx` | Centre d’alertes |
| `account` | `AccountPage.tsx` | Profil personnel |
| `admin` | `AdminPage.tsx`, `AdminCommunitiesTab.tsx` | Back-office |

Composants transverses : `Layout`, `AppHeader`, `CommunitySwitcher`, `BottomNav`, `UserAvatar`, `CommunityAvatar`, `DialogueStream`, `TelemetryTracker`, `AdminCommunityBanner`, `AdminActingRoleBar`.

---

## 7. Déploiement et environnements

### 7.1 Production (Coolify)

- **Domaine** : `mandala.eludein.art`
- **DNS** : enregistrement A chez Hostinger → IP VPS (pas de proxy SSL Hostinger devant Coolify)
- **Build** : **Dockerfile** obligatoire (Nixpacks échoue à cause locale FR / script `suivant`)
- **Port conteneur** : 3000
- **Réseau** : `coolify`
- **MariaDB** : instance dédiée Mandala (≠ Fleur d’AmOurs)

Variables typiques (voir `docker-compose.env.example`) :

- `MARIADB_*`, `DB_PREFIX=mdl_`, `JWT_SECRET` (fort, unique)
- `NEXT_PUBLIC_APP_URL=https://mandala.eludein.art`
- `NEXT_PUBLIC_API_URL` vide (API même origine)
- `MANDALA_ADMIN_EMAILS` pour admins bootstrap

Post-déploiement recommandé :

```bash
node scripts/apply-all-schemas.mjs
node scripts/grant-admin.mjs votre@email.com
```

### 7.2 Développement local

- **Option A (recommandée)** : `npm run dev.vps` — tunnel SSH PC `3308` → VPS `3307` (socat MariaDB Mandala)
- **Option B** : MariaDB locale, `next/.env.local`
- URL dev : `http://localhost:3002`
- Santé : `GET /api/health` → `{ "api": "mandala", "db": "connected" }`

### 7.3 Problèmes connus / résolus

| Symptôme | Cause / solution |
|----------|------------------|
| Erreur 500 admin communautés | Colonnes manquantes → `apply-all-schemas.mjs` |
| Page bloquée « Chargement » | Tunnel SSH mort ou cache `.next` |
| Deploy Nixpacks | Utiliser Dockerfile |
| Healthcheck unhealthy | `curl` + `/api/health/live` dans image |
| « Non sécurisé » navigateur | Activer **Force HTTPS** Coolify ; favori `https://` |
| `ECONNREFUSED 127.0.0.1:3308` | Relancer `npm run dev.vps` |

---

## 8. Ce qui n’est PAS dans Mandala (périmètre exclu)

Portage **refusé** depuis Fleur d’AmOurs (voir `MANDALA-PORTING-MANIFEST.md`) :

- IA (`/api/ai/**`), fleur/tarot/dreamscape, SAP, billing, coach avancé
- Manuel public, Capacitor, Phaser, jeux

Mandala reste une **app web** communautaire, pas un clone complet de Fleur.

---

## 9. Évolutions possibles (backlog indicatif)

Pour brainstorming Gemini — **non engagé** :

- Mur d’actualités communautaire côté membre (au-delà des broadcasts admin)
- Raffinement push notifications (FCM) et e-mail transactionnel
- Calendrier export iCal, rappels événements
- Modération, signalement, RGPD export données
- Rôles fins par événement (permissions granulaires)
- Internationalisation (UI actuellement FR)
- PWA offline léger, installation mobile
- Intégration paiement / cotisations (hors scope actuel)

---

## 10. Fichiers de référence pour approfondir

| Sujet | Fichier |
|-------|---------|
| Cahier des charges initial | `docs/CAHIER-DES-CHARGES.md` |
| Guide dev + Git | `docs/GUIDE-DEV-ET-DEPLOI.md` |
| Déploiement Coolify | `docs/DEPLOY-COOLIFY-PROD.md`, `docs/COOLIFY-MANDALA-SETUP.md` |
| Manifeste portage Fleur → Mandala | `MANDALA-PORTING-MANIFEST.md` |
| Config rapide | `CONFIG-RAPIDE.md` |
| Middleware HTTPS | `next/src/middleware.ts` |
| Config Next sécurité | `next/next.config.ts` |
| Constantes événements | `next/src/lib/event-constants.ts` |
| Intentions graines | `next/src/api/social.ts` |

---

## 11. Prompts suggérés pour Gemini

Copier-coller en préfixant : *« Contexte : voir document Mandala ci-joint. »*

1. **Produit** : « Propose 5 user stories pour le module événements phase “Après”, en gardant le vocabulaire graines / clairière. »
2. **Architecture** : « Comment isoler la messagerie par communauté sans casser les canaux P2P existants ? »
3. **UX** : « Rédige le wireframe textuel d’un mur communautaire cohérent avec la navigation actuelle. »
4. **Data** : « Schéma SQL pour un système de cotisation annuelle par communauté, compatible préfixe mdl_. »
5. **Sécurité** : « Audit des surfaces admin : acting role vs droits serveur — risques et mitigations. »

---

## 12. Métadonnées pour l’IA

- **Langue UI** : français
- **Ton** : bienveillant, symbolique (jardin), pas corporate
- **Utilisateurs types** : membre, organisateur communauté, admin app
- **Contrainte technique** : petit VPS — pool MariaDB limité (`MARIADB_POOL_LIMIT=2`)
- **Ne jamais inventer** de secrets (`JWT_SECRET`, mots de passe DB) dans les réponses — utiliser des placeholders

---

*Document généré pour faciliter le travail conceptuel sur Mandala. Pour mettre à jour : modifier ce fichier après chaque jalon produit majeur.*
