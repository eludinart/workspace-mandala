# Design — Admin Pilotage (P0 + P1 + P2)

Date : 2026-11-11  
Statut : accepted · implémentation  
Public : `requireAdmin` uniquement

## Objectif

Onglet **Pilotage** : croissance, engagement, santé lieux, funnels, export — pas un clone Charge/Push.

## Périmètre livré

### P0 — Vue d’ensemble
- KPI période (7 / 30 / 90 j) : inscriptions, joins, sans lieu, actifs 24 h, total comptes
- Séries journalières inscriptions / joins
- Fil d’activité (inscriptions + joins)

### P1 — Instrumentation
- Table `mdl_product_events` (append-only)
- Table `mdl_user_session_days` (user_id × day civil Paris, unique)
- Émissions : `user.registered`, `place.joined`, `place.left`, `onboarding.continue_without_place`, `charter.accepted`, `session.daily` (via heartbeat)
- DAU / WAU / MAU depuis `session_days`
- Funnel : inscrit → (lieu | sans lieu) → actif J+1 / J+7 (approx. sessions)

### P2 — Pilotage avancé
- Tableau **santé lieux** (membres, joins 30 j, activité récente)
- **Alertes** dérivées (seuils) dans le JSON dashboard
- **Export CSV** du fil / séries (`GET .../export?kind=activity|series`)
- **Santé serveur & application** : réutilise `buildAdminLoadDashboard` (RPS, latence, pool, push) dans le même onglet

## Hors scope

FullStory, Metabase, contenu messages, Telegram Hermes (peut consommer l’API plus tard).

## API

- `GET /api/admin/pilotage?days=7|30|90`
- `GET /api/admin/pilotage/export?days=&kind=`

## UI

`AdminPilotageTab` ; nav `adminTab: 'pilotage'` en tête de section main.
