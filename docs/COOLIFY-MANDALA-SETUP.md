# Coolify — déployer l’application Mandala

À faire **après** le push GitHub (`eludinart/workspace-mandala`).

## 1. Nouvelle application dans le projet Mandala-db

1. Ouvrir **https://cp.eludein.art** (Coolify).
2. Projet **Mandala-db** → environnement **production**.
3. **+ New** → **Application** → **Public Repository** (ou GitHub App si configurée).
4. URL Git : `https://github.com/eludinart/workspace-mandala`
5. Branche : `main`
6. **Build Pack** : `Dockerfile` (**obligatoire** — ne pas laisser Nixpacks)
7. **Dockerfile location** : `/Dockerfile` (ou `/Dockerfile.next`)
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
| `VAPID_SUBJECT` | `mailto:admin@mandala.eludein.art` |
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | idem (secret) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **identique** à `VAPID_PUBLIC_KEY` |

**Build args** (si proposés par Coolify) :

| Build arg | Valeur |
|-----------|--------|
| `NEXT_PUBLIC_APP_URL` | même URL HTTPS |
| `NEXT_PUBLIC_API_URL` | vide |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | même clé publique VAPID |

Push smartphone : [PUSH-SMARTPHONE.md](PUSH-SMARTPHONE.md).

## 3. Lier la base MariaDB

Dans la fiche application → **Storages** / **Connected databases** (selon version Coolify) : lier la ressource **mariadb-database-mandala** du même projet.

Sinon `MARIADB_HOST` pointe déjà vers le hostname interne du conteneur.

## 4. Déployer

1. **Deploy** (premier build peut prendre plusieurs minutes).
2. Logs : build `Dockerfile` → `npm ci` → `npm run build:docker` → image Node 22.
3. Vérifier : `GET https://mandala.eludein.art/api/health` → `"db":"connected"`.
4. Migrations SQL : `node scripts/apply-all-schemas.mjs` (tunnel ou VPS). Voir [DEPLOY-COOLIFY-PROD.md](./DEPLOY-COOLIFY-PROD.md).
5. Admin : `node scripts/grant-admin.mjs votre@email.com` puis reconnexion.

### Accélérer les builds Coolify

| Cause | Piste |
|-------|--------|
| **`npm run build` à chaque push** | Le Dockerfile utilise `build:docker` (sans `tsc`) — le typecheck reste en CI GitHub. |
| **`npm ci` lent** | BuildKit cache npm (`RUN --mount=type=cache`) — actif si BuildKit est activé sur le serveur (défaut Coolify récent). |
| **Nouvelle image à chaque commit** | Normal : seule l’étape `npm ci` est mise en cache si `package-lock.json` inchangé. |
| **VPS peu puissant** | Un build Next.js prend souvent **45–90 s** sur un petit VPS ; c’est attendu. |
| **Déploiements inutiles** | Désactiver le webhook auto-deploy pour les commits docs-only, ou déployer à la main. |

Le dépôt Git est léger (~1 Mo) : le temps est surtout CPU (compilation Next.js), pas le clone.

## 5. Relais socat dev (déjà fait)

Sur le VPS, pour le dev local :

- Fleur : `127.0.0.1:3306`
- Mandala : `127.0.0.1:3307` → conteneur `p11nw75ijqbg4lfzmwbw2m3m`

Script : `scripts/setup-mariadb-tunnel-mandala.sh`

## 6. Webhook auto-deploy (optionnel)

Coolify → application → **Webhooks** : activer deploy on push vers `main`.

---

Voir aussi : [GUIDE-DEV-ET-DEPLOI.md](./GUIDE-DEV-ET-DEPLOI.md)
