# Déployer Mandala sur Coolify (production)

Checklist pour mettre en ligne la bêta actuelle sur **https://cp.eludein.art** (projet **Mandala-db**).

## Prérequis

- Dépôt GitHub : `https://github.com/eludinart/workspace-mandala` (branche `main`)
- MariaDB Coolify déjà créée : **mariadb-database-mandala** (`MARIADB_HOST` interne ≈ `p11nw75ijqbg4lfzmwbw2m3m`)
- Secrets dans `nogit/variables a proteger` ou Coolify UI (jamais dans Git)

---

## Étape 1 — Pousser le code

```powershell
cd c:\workspace-mandala
npm run build
.\scripts\build-and-push.ps1 -CommitMessage "feat: bêta Mandala (communautés, admin, événements, messagerie)"
```

Vérifier sur GitHub que `main` contient le dernier commit.

---

## Étape 2 — Application Coolify

1. **https://cp.eludein.art** → projet **Mandala-db** → **production**
2. Si l’app n’existe pas : **+ New** → **Application**
   - Repo : `eludinart/workspace-mandala`
   - Branche : `main`
   - Build pack : **Dockerfile** (⚠️ **pas Nixpacks** — sinon erreur `suivant: introuvable`)
   - Dockerfile : `/Dockerfile` ou `/Dockerfile.next` (même contenu)
   - Port : **3000**
   - Domaine : `https://mandala.eludein.art` (ou votre choix)
   - Réseau Docker : **coolify**
3. Lier la base **mariadb-database-mandala** (Connected databases / Storages)

---

## Étape 3 — Variables d’environnement (runtime)

Copier dans Coolify → Application → **Environment** (pas dans le repo) :

| Variable | Valeur |
|----------|--------|
| `MARIADB_HOST` | `p11nw75ijqbg4lfzmwbw2m3m` |
| `MARIADB_PORT` | `3306` |
| `MARIADB_DATABASE` | `default` |
| `MARIADB_USER` | `mariadb` |
| `MARIADB_PASSWORD` | *(secret Mandala-db)* |
| `DB_PREFIX` | `mdl_` |
| `JWT_SECRET` | **Secret fort unique prod** |
| `JWT_EXPIRE_HOURS` | `720` |
| `NEXT_PUBLIC_APP_URL` | `https://mandala.eludein.art` |
| `NEXT_PUBLIC_API_URL` | *(vide)* |
| `NEXT_PUBLIC_BASE_PATH` | *(vide)* |
| `MARIADB_POOL_LIMIT` | `2` |
| `NODE_ENV` | `production` |

**Build arguments** (même écran ou section Build) :

| Build arg | Valeur |
|-----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://mandala.eludein.art` |
| `NEXT_PUBLIC_API_URL` | *(vide)* |

---

## Étape 4 — Déployer

1. **Deploy** (ou attendre le webhook si activé sur `main`)
2. Logs : `Dockerfile.next` → `npm ci` → `npm run build` → démarrage `node server.js`
3. Santé : `GET https://mandala.eludein.art/api/health` → `"db":"connected"`

---

## Étape 5 — Migrations SQL (après premier deploy)

Les tables sont aussi créées au runtime (`ensure*Tables`), mais pour la prod exécutez les schémas documentés :

**Option A — depuis votre PC (tunnel SSH actif)** :

```powershell
# Terminal 1 : npm run dev.vps  (ou tunnel -L 3308:127.0.0.1:3307)
# Terminal 2 :
cd c:\workspace-mandala
node scripts/apply-all-schemas.mjs
```

**Option B — sur le VPS** :

```bash
ssh root@187.124.42.135
cd /chemin/vers/workspace-mandala   # ou copier scripts + docs/schema
MARIADB_HOST=p11nw75ijqbg4lfzmwbw2m3m MARIADB_PORT=3306 \
MARIADB_DATABASE=default MARIADB_USER=mariadb MARIADB_PASSWORD='…' \
node scripts/apply-all-schemas.mjs
```

---

## Étape 6 — Compte administrateur

```powershell
node scripts/grant-admin.mjs eludinart@gmail.com
# ou l’email exact du compte WordPress / Mandala
```

Puis **déconnexion / reconnexion** sur le site prod pour rafraîchir le JWT.

---

## Étape 7 — Vérifications fonctionnelles

- [ ] Connexion / inscription
- [ ] Accueil communauté (avatar, description)
- [ ] Admin → Technique → Communautés (édition Shambhala)
- [ ] Événements, membres, messages
- [ ] `GET /api/health` OK

---

## Webhook auto-deploy (recommandé)

Coolify → Application → **Webhooks** → activer deploy sur push `main`.

---

## Dépannage

### « Page 404 introuvable » (texte noir, pas l’UI Mandala)

Ce message vient en général du **proxy Coolify/Traefik**, pas de l’app Next.js : le conteneur ne tourne pas ou le **port** est faux.

1. **Configuration → General → Build Pack** = **Dockerfile** (pas Nixpacks).
2. **Ports / Network** → **Port exposé** = `3000` (identique au `EXPOSE` du Dockerfile).
3. **Domains** → `mandala.eludein.art` bien rattaché à **cette** application (pas une autre ressource).
4. **Logs** (runtime, pas build) : doit afficher `[mandala] PORT=3000` puis pas de crash. Si redémarrage en boucle → variables manquantes (`JWT_SECRET`, `MARIADB_PASSWORD`).
5. Tester l’URL Coolify générée (`*.sslip.io`) avant le domaine custom.
6. **HTTPS** : Coolify → domaine → activer **HTTPS** / Let’s Encrypt (sinon « Non sécurisé » en HTTP et 503 possible en HTTPS sans backend sain).
7. Santé : `https://mandala.eludein.art/api/health` → `{"ok":true,"db":"connected"}`.

| Symptôme | Action |
|----------|--------|
| Build échoue | Build Pack = **Dockerfile**, pas Nixpacks ; logs doivent montrer `Dockerfile.next` ou `Dockerfile`, pas `nixpacks plan` |
| `suivant: introuvable` | Nixpacks + locale FR : passer en **Dockerfile** et redeploy |
| 404 / 503 au domaine | Port **3000**, conteneur **Running**, variables env, redeploy dernier `main` |
| `db: disconnected` | `MARIADB_HOST` = hostname interne, réseau **coolify**, mot de passe OK |
| 502 / app crash | Logs runtime Coolify ; `JWT_SECRET` défini en prod |
| Ancienne version | Vérifier SHA déployé = dernier commit GitHub |
| Erreur colonne SQL | `node scripts/apply-all-schemas.mjs` |

Voir aussi : [COOLIFY-MANDALA-SETUP.md](./COOLIFY-MANDALA-SETUP.md), [GUIDE-DEV-ET-DEPLOI.md](./GUIDE-DEV-ET-DEPLOI.md)
