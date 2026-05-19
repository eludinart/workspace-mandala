# Coolify — déployer l’application Mandala

À faire **après** le push GitHub (`eludinart/workspace-mandala`).

## 1. Nouvelle application dans le projet Mandala-db

1. Ouvrir **https://cp.eludein.art** (Coolify).
2. Projet **Mandala-db** → environnement **production**.
3. **+ New** → **Application** → **Public Repository** (ou GitHub App si configurée).
4. URL Git : `https://github.com/eludinart/workspace-mandala`
5. Branche : `main`
6. **Build Pack** : `Dockerfile`
7. **Dockerfile location** : `/Dockerfile.next`
8. **Port** (exposes) : `3000`
9. **Domaine** : `https://mandala.eludein.art` (ou sous-domaine de votre choix)
10. Réseau : **coolify** (déjà le cas si même serveur que Fleur).

> Next.js Mandala = **une seule app** (API + front). Pas deux services comme Korymb.

## 2. Variables d’environnement (Coolify UI)

Copier depuis `docker-compose.env.example` et remplir les secrets depuis **Mandala-db** → MariaDB (ou `nogit/variables a proteger` en local).

| Variable | Valeur production |
|----------|-------------------|
| `MARIADB_HOST` | `p11nw75ijqbg4lfzmwbw2m3m` |
| `MARIADB_PORT` | `3306` |
| `MARIADB_DATABASE` | `default` |
| `MARIADB_USER` | `mariadb` |
| `MARIADB_PASSWORD` | *(secret Coolify Mandala-db)* |
| `DB_PREFIX` | `mdl_` |
| `JWT_SECRET` | **Nouveau** secret fort (≠ Fleur, ≠ dev) |
| `JWT_EXPIRE_HOURS` | `720` |
| `NEXT_PUBLIC_APP_URL` | `https://mandala.eludein.art` |
| `NEXT_PUBLIC_API_URL` | *(vide)* |
| `MARIADB_POOL_LIMIT` | `2` |

**Build args** (si proposés par Coolify) :

| Build arg | Valeur |
|-----------|--------|
| `NEXT_PUBLIC_APP_URL` | même URL HTTPS |
| `NEXT_PUBLIC_API_URL` | vide |

## 3. Lier la base MariaDB

Dans la fiche application → **Storages** / **Connected databases** (selon version Coolify) : lier la ressource **mariadb-database-mandala** du même projet.

Sinon `MARIADB_HOST` pointe déjà vers le hostname interne du conteneur.

## 4. Déployer

1. **Deploy** (premier build peut prendre plusieurs minutes).
2. Logs : build `Dockerfile.next` → `npm ci` → `npm run build` → image Node 22.
3. Vérifier : `GET https://mandala.eludein.art/api/health` → `"db":"connected"`.

## 5. Relais socat dev (déjà fait)

Sur le VPS, pour le dev local :

- Fleur : `127.0.0.1:3306`
- Mandala : `127.0.0.1:3307` → conteneur `p11nw75ijqbg4lfzmwbw2m3m`

Script : `scripts/setup-mariadb-tunnel-mandala.sh`

## 6. Webhook auto-deploy (optionnel)

Coolify → application → **Webhooks** : activer deploy on push vers `main`.

---

Voir aussi : [GUIDE-DEV-ET-DEPLOI.md](./GUIDE-DEV-ET-DEPLOI.md)
