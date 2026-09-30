---
name: mandala
description: App Mandala — mur vivant lieux & communautés (carte, événements, compétences, ressources). Repo github.com/eludinart/workspace-mandala. Next.js + MariaDB Coolify. Prod mandala.eludein.art.
icon: canvas
color: orange
---

# Mandala

**Prod :** https://mandala.eludein.art  
**Repo :** https://github.com/eludinart/workspace-mandala  

Mur vivant des **lieux & communautés** (ex. Shambhala, SÏvåñà, …) — carte, événements, messages d’organisateurs, compétences, ressources. France / Belgique / Suisse / francophone.

Socle technique proche de Fleur (auth, MariaDB, social léger) — **bases et ports séparés**.

## Repo & chemins

| | |
| --- | --- |
| **GitHub** | https://github.com/eludinart/workspace-mandala |
| **Workspace local** | `c:\workspace-mandala` |
| **App Next** | dossier `next/` |
| **Dev VPS DB** | `npm run dev.vps` → http://localhost:**3002** |
| **Health** | `/api/health` → `"api":"mandala","db":"connected"` |
| **Docs** | `docs/GUIDE-DEV-ET-DEPLOI.md`, `docs/COOLIFY-MANDALA-SETUP.md`, `CONFIG-RAPIDE.md` |

## Stack & infra

| | Fleur (réf.) | Mandala |
| --- | --- | --- |
| Port Next dev | 3001 | **3002** |
| Tunnel PC → VPS | 3307 → 3306 | **3308 → 3307** |
| Préfixe tables | `wp_` / `wp_fleur_*` | **`mdl_`** |
| Coolify DB | MariaDB Fleur | **Mandala-db** |

- **Next.js** PWA (`start_url` `/app`)
- Landing `/` (ancres `#mur` `#lieux` `#competences` `#ressources` `#projet`)
- Déploiement Coolify sur le même VPS que Fleur / Korymb / Hermes
- Secrets hors git : `sync-config.env`, `next/.env.local`, `nogit/`

## Principes produit

1. Techno au service des **lieux** et du lien humain.
2. Charte de lieu avant intégration communauté.
3. Contenu public vs membres : respecter les frontières.
4. Ne pas mélanger tunnels/ports avec Fleur ou Korymb.
5. Ne pas confondre avec Korymb (missions IA) ni Fleur (jardin relationnel).

## Instructions agent

1. Repo **eludinart/workspace-mandala** uniquement.
2. Charger `ecosysteme-elude` ; `hermes-vps` si ops/DB.
3. Vérifier `/api/health` après changement DB.
4. Push/deploy : scripts repo (`build-and-push.ps1`, guides Coolify) — pas de secrets dans le commit.
5. Si Hermes doit analyser Mandala : ajouter un script readonly dédié (ne pas réutiliser `fleur-sql.sh`).
