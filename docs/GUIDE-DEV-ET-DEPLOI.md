# Mandala — guide dev, Git et déploiement

Document de référence rapide pour travailler en local (Cursor) avec la **base MariaDB du VPS**, pousser sur **GitHub** et déployer sur **Coolify**.

**Compte GitHub** : `eludinart` (même organisation que Fleur : `fleur-amours`).

---

## 1. Architecture (deux apps, deux bases)

| | **Fleur d'Amour** | **Mandala** |
|---|-------------------|-------------|
| Dossier local | `c:\workspace` | `c:\workspace-mandala` |
| GitHub (existant) | `eludinart/fleur-amours` | **À créer** → `eludinart/workspace-mandala` (recommandé) |
| Next.js dev | port **3001** | port **3002** |
| Base Coolify | MariaDB Fleur | MariaDB **Mandala-db** |
| Conteneur Docker DB | `t46uf7n66xkz0hwxp6pb23ax` (Fleur) | `p11nw75ijqbg4lfzmwbw2m3m` |
| Nom base SQL | `default` | `default` |
| Préfixe tables | `wp_` | `mdl_` |
| Relais socat VPS | `127.0.0.1:3306` → Fleur | `127.0.0.1:3307` → Mandala |
| Tunnel SSH PC | `3307` → VPS `3306` | `3308` → VPS `3307` |
| Commande dev | `npm run dev.vps` | `npm run dev.vps` |

**Règle** : un tunnel = une base. Ne pas mélanger les ports ni les `sync-config.env`.

---

## 2. Fichiers de configuration (secrets)

| Fichier | Rôle | Git |
|---------|------|-----|
| `sync-config.env` | SSH + mots de passe MariaDB dev | **Jamais** |
| `next/.env.local` | Variables Next en dev local | **Jamais** |
| `nogit/` | Notes / secrets manuels | **Jamais** |
| `docker-compose.env` | Prod Coolify (copie locale) | **Jamais** |
| `sync-config.env.example` | Modèle sans secrets | Oui |
| `.env.example` | Modèle général | Oui |

**Première fois** :

```powershell
cd c:\workspace-mandala
copy sync-config.env.example sync-config.env
# Éditer sync-config.env : LOCAL_PASS = mot de passe Coolify (onglet MariaDB Mandala-db)
```

Les mots de passe sont dans **Coolify** → projet **Mandala-db** → `mariadb-database-mandala` → Variables / Connection.

---

## 3. Démarrage serveur local (quotidien)

### Mandala — données VPS (recommandé)

```powershell
cd c:\workspace-mandala
npm run dev.vps
```

- Lance le **tunnel SSH** (`localhost:3308` → VPS `3307`).
- Lance **Next.js** sur http://localhost:3002.
- Arrêt : **Ctrl+C** dans le terminal.

**Vérifications** :

| URL | Attendu |
|-----|---------|
| http://localhost:3002 | Interface |
| http://localhost:3002/api/health | `{"ok":true,"api":"mandala","db":"connected"}` |

### Fleur — données VPS (référence)

```powershell
cd c:\workspace
node scripts/dev-vps.js
# ou npm run dev.vps si configuré
```

→ http://localhost:3001

### Mandala sans tunnel (MariaDB locale uniquement)

```powershell
cd c:\workspace-mandala\next
# .env.local avec MARIADB_HOST=127.0.0.1 MARIADB_PORT=3306
npm run dev
```

---

## 4. VPS — relais socat (une fois, ou après redémarrage)

Connexion SSH :

```powershell
ssh root@187.124.42.135
```

**Mandala** (port VPS 3307) :

```bash
docker rm -f mariadb-tunnel-mandala 2>/dev/null
docker run -d --name mariadb-tunnel-mandala --restart unless-stopped \
  --network coolify \
  -p 127.0.0.1:3307:3306 \
  alpine/socat \
  TCP-LISTEN:3306,fork,reuseaddr TCP:p11nw75ijqbg4lfzmwbw2m3m:3306
```

**Fleur** (port VPS 3306) — déjà en place si `mariadb-tunnel` tourne :

```bash
docker ps --filter name=mariadb-tunnel
```

Script local : `scripts/setup-mariadb-tunnel-mandala.sh` (à exécuter sur le VPS).

---

## 5. Coolify — Mandala (production)

### 5.1 MariaDB (fait)

- Projet Coolify : **Mandala-db** → **mariadb-database-mandala**
- Conteneur : `p11nw75ijqbg4lfzmwbw2m3m`
- Base : `default`, utilisateur : `mariadb`

### 5.2 Application Next.js (à configurer)

1. Coolify → **+ New Resource** → **Application**.
2. Source Git : `https://github.com/eludinart/workspace-mandala` (après création du repo, §6).
3. Branche : `main`.
4. **Dockerfile** : `Dockerfile.next` (racine du repo).
5. Port interne : **3000**.
6. Domaine : ex. `mandala.eludein.art`.
7. Réseau : **coolify** (même que la DB).
8. Lier la ressource MariaDB **Mandala-db**.

**Variables d'environnement** (Coolify UI, pas dans Git) :

| Variable | Valeur |
|----------|--------|
| `MARIADB_HOST` | Hostname **interne** Coolify de la DB (ex. `p11nw75ijqbg4lfzmwbw2m3m`) |
| `MARIADB_PORT` | `3306` |
| `MARIADB_DATABASE` | `default` |
| `MARIADB_USER` | `mariadb` |
| `MARIADB_PASSWORD` | Secret Coolify |
| `DB_PREFIX` | `mdl_` |
| `JWT_SECRET` | **Nouveau** secret fort (≠ Fleur) |
| `JWT_EXPIRE_HOURS` | `720` |
| `NEXT_PUBLIC_APP_URL` | `https://mandala.eludein.art` |
| `NEXT_PUBLIC_API_URL` | *(vide)* |
| `MARIADB_POOL_LIMIT` | `2` |

9. **Deploy** → tester `https://votre-domaine/api/health`.

---

## 6. GitHub — première mise en place

### État actuel

- Le dossier `c:\workspace-mandala` est un dépôt Git local.
- **Aucun dépôt GitHub Mandala** n'existe encore sous `eludinart` (à créer).

### Créer le dépôt et pousser (automatique)

```powershell
# Une fois : installer GitHub CLI (winget install GitHub.cli) puis :
gh auth login

cd c:\workspace-mandala
.\scripts\setup-github.ps1
```

Crée le dépôt privé **`eludinart/Mandala`** et pousse `main`.

### Manuel (alternative)

1. https://github.com/new → `eludinart` / **Mandala** / Private / sans README
2. `git remote add origin https://github.com/eludinart/Mandala.git`
3. `git push -u origin main`

---

## 7. Build, commit et push (routine)

### Vérifications avant tout commit

```powershell
cd c:\workspace-mandala
git status
```

**Ne doit pas apparaître** : `sync-config.env`, `next/.env.local`, `nogit/`, `next/.next/`, `node_modules/`.

### Build local

```powershell
cd c:\workspace-mandala
npm run build
```

Si erreur bizarre (chunks manquants) :

```powershell
Remove-Item -Recurse -Force .\next\.next -ErrorAction SilentlyContinue
npm run build
```

### Script tout-en-un (recommandé)

```powershell
cd c:\workspace-mandala
.\scripts\build-and-push.ps1 -CommitMessage "feat: description de la livraison"
```

Options :

- `-SkipBuild` — commit + push sans rebuild
- `-NoPush` — build + commit seulement

### Manuel

```powershell
git add -A
git status   # revérifier l'absence de secrets
git commit -m "feat: ma livraison"
git push origin main
```

---

## 8. Déploiement Coolify après un push

1. `git push origin main` terminé avec succès.
2. Coolify → application Mandala → **Deploy** (ou webhook auto si activé).
3. Vérifier les logs de build (Dockerfile.next, Node 22).
4. Contrôler le **commit SHA** déployé = dernier commit GitHub.
5. Tester en prod : `GET /api/health` sur le domaine HTTPS.

---

## 9. Sécurité du code source

- [ ] `.gitignore` couvre `.env*`, `sync-config.env`, `nogit/`, `.next/`, `node_modules/`
- [ ] Repo GitHub en **privé** pour Mandala
- [ ] `JWT_SECRET` prod **différent** de Fleur et du dev
- [ ] Ne jamais coller de mots de passe dans les issues / commits / chat
- [ ] `scripts/build-and-push.ps1` bloque si un fichier sensible est stagé
- [ ] Sauvegardes Coolify / exports DB selon votre politique hébergeur

---

## 10. Dépannage rapide

| Problème | Solution |
|----------|----------|
| `db: disconnected` | Tunnel SSH actif ? `npm run dev.vps` ou `ssh -N -L 3308:127.0.0.1:3307 root@187.124.42.135` |
| Port 3002 occupé | Fermer l’autre `npm run dev` / `dev.vps` |
| `MARIADB_PASSWORD requis` | Remplir `sync-config.env` ou `next/.env.local` |
| Mauvaises données (Fleur) | Vérifier `TUNNEL_LOCAL_PORT=3308` et socat Mandala sur VPS `:3307` |
| `No such container` | Conteneur = `p11nw75ijqbg4lfzmwbw2m3m`, pas le libellé Coolify |
| Build Next échoue | Supprimer `next/.next`, relancer `npm run build` |

---

## 11. Commandes une ligne (mémo)

```powershell
# Dev Mandala (VPS DB)
cd c:\workspace-mandala; npm run dev.vps

# Santé
curl http://localhost:3002/api/health

# SSH VPS
ssh root@187.124.42.135

# Build + push
cd c:\workspace-mandala; .\scripts\build-and-push.ps1 -CommitMessage "feat: ..."

# Tunnel manuel Mandala
ssh -N -L 3308:127.0.0.1:3307 root@187.124.42.135
```

---

## 12. Liens utiles

| Ressource | Chemin / URL |
|-----------|----------------|
| Schéma SQL | `docs/schema/001_mandala_core.sql` |
| Exemple env sync | `sync-config.env.example` |
| Docker prod | `Dockerfile.next`, `docker-compose.next.yml` |
| Fleur (référence) | `c:\workspace\docs\BUILD-AND-GIT-DEPLOY.md` |
| GitHub Fleur | https://github.com/eludinart/fleur-amours |

---

*Dernière mise à jour : configuration dev VPS Mandala (socat 3307, tunnel PC 3308, conteneur `p11nw75ijqbg4lfzmwbw2m3m`).*
