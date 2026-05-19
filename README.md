# Mandala

Plateforme multi-communautés (Shambhala, Sivanà, …) — lieux, membres, événements, messages.

Extrait du socle technique de [Fleur d'AmOurs](../workspace) (auth, MariaDB, social léger).

**Guide dev, Git, Coolify** : [docs/GUIDE-DEV-ET-DEPLOI.md](docs/GUIDE-DEV-ET-DEPLOI.md) · mémo : [CONFIG-RAPIDE.md](CONFIG-RAPIDE.md)

## Développement local

### Option A — MariaDB sur le VPS (recommandé, comme Fleur)

1. Sur le VPS : relais socat Mandala (`scripts/setup-mariadb-tunnel-mandala.sh`) → `127.0.0.1:3307`.
2. Copier `sync-config.env.example` → `sync-config.env` et renseigner `LOCAL_PASS` (Coolify).
3. `cd next && npm install`
4. À la racine : **`npm run dev.vps`** (tunnel SSH + Next sur le port **3002**).

```powershell
cd c:\workspace-mandala
copy sync-config.env.example sync-config.env
# éditer sync-config.env (mot de passe MariaDB Coolify)
cd next && npm install && cd ..
npm run dev.vps
```

Ouvrir http://localhost:3002 — test : `/api/health` → `"db": "connected"`.

| Projet | Tunnel PC | Port VPS socat | Commande |
|--------|-----------|----------------|----------|
| Fleur | 3307 → 3306 | 3306 | `npm run dev.vps` dans `c:\workspace` |
| Mandala | 3308 → 3307 | 3307 | `npm run dev.vps` dans `c:\workspace-mandala` |

### Option B — MariaDB locale

1. Copier `.env.example` vers `next/.env.local`.
2. `npm run dev` (port **3002**).

## Coolify (3ᵉ app sur le serveur)

### 1. Base MariaDB

- Nouvelle ressource **MariaDB** dédiée Mandala (ne pas réutiliser la DB Fleur).
- Noter host interne, user, password, database.
- Exécuter `docs/schema/001_mandala_core.sql` (optionnel : les tables communautés se créent aussi au runtime).

### 2. Application

- **Git** : repo `workspace-mandala` (ou monorepo path `mandala/`).
- **Build** : Dockerfile `Dockerfile.next` (Node 22).
- **Port** : 3000 interne.
- **Domaine** : ex. `mandala.eludein.art`.
- Réseau Docker **coolify** (comme Fleur / Corembe).

### 3. Variables d'environnement

| Variable | Exemple |
|----------|---------|
| `MARIADB_HOST` | hostname interne Coolify |
| `MARIADB_DATABASE` | `mandala` |
| `MARIADB_USER` / `MARIADB_PASSWORD` | secrets dédiés |
| `DB_PREFIX` | `mdl_` |
| `JWT_SECRET` | nouveau secret (≠ Fleur) |
| `NEXT_PUBLIC_APP_URL` | URL publique HTTPS |
| `NEXT_PUBLIC_API_URL` | vide (même origine) |
| `MARIADB_POOL_LIMIT` | `2` sur petit VPS |

### 4. Vérification

- `GET /api/health` → `{ "api": "mandala", "db": "connected" }`
- Inscription → login → sélecteur Shambhala / Sivanà

## Structure

```
workspace-mandala/
  next/           # App Next.js 15
  docs/schema/    # SQL
  Dockerfile.next
  docker-compose.next.yml
  MANDALA-PORTING-MANIFEST.md
```
