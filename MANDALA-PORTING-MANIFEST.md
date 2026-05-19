# Mandala — manifeste d'extraction (source : Fleur d'Amour)

## Produit

- **Nom** : Mandala
- **Repo source** : `c:\workspace` (Fleur d'AmOurs)
- **Préfixe DB** : `mdl_`
- **Communautés seed** : `shambhala`, `sivana`

## Déjà porté dans ce workspace

| Tier | Contenu |
|------|---------|
| A | `db.ts`, `jwt`, `api-auth`, `db-auth`, `api-client`, auth API, health |
| B | `db-social`, `db-prairie`, `db-notifications`, social/prairie/notifications API |
| Multi | `db-communities`, `CommunityContext`, sélecteur UI |
| UI MVP | Login, Home, Events (démo), Members (prairie), Messages (placeholder), Account |

## À repiocher depuis Fleur (chemins relatifs `next/src`)

- `lib/db-broadcasts.ts` + `app/api/admin/broadcasts/*` → mur / annonces
- `views/ClairierePage.tsx` + `components/social/*` → messages complets
- `lib/smtp.ts` → emails
- `lib/fcm.ts` + push → notifications mobile
- `lib/telemetry/*` + `AdminTelemetryPage` → debug prod
- **Nouveau** : module `events` (tables `mdl_events`, phases, tâches)

## Ne pas porter

- `app/api/ai/**`, fleur, tarot, dreamscape, sap, billing, coach/*
- `public/manuel/**`, Capacitor, Phaser

## Variables Coolify

Voir `docker-compose.env.example` et `README.md`.
