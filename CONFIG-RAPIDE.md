# Mandala — config rapide

Guide complet : **[docs/GUIDE-DEV-ET-DEPLOI.md](docs/GUIDE-DEV-ET-DEPLOI.md)**

## Dev local (base VPS)

```powershell
cd c:\workspace-mandala
npm run dev.vps
```

→ http://localhost:3002 · test : `/api/health`

## Build + Git + push

```powershell
cd c:\workspace-mandala
.\scripts\build-and-push.ps1 -CommitMessage "feat: ..."
```

## GitHub

```powershell
gh auth login
.\scripts\setup-github.ps1
```

→ dépôt **https://github.com/eludinart/workspace-mandala** (privé). Guide : [docs/GUIDE-DEV-ET-DEPLOI.md](docs/GUIDE-DEV-ET-DEPLOI.md) §6.

## Coolify (prod)

Guide : [docs/COOLIFY-MANDALA-SETUP.md](docs/COOLIFY-MANDALA-SETUP.md)

Variables prod prêtes sur le VPS : `/root/mandala-coolify-production.env` (SSH root, copier dans l’UI Coolify).

## Secrets (hors Git)

- `sync-config.env` — tunnel + MariaDB
- `next/.env.local` — Next dev
- `nogit/` — notes privées

## Notifications push (smartphone)

Checklist : **[docs/PUSH-SMARTPHONE.md](docs/PUSH-SMARTPHONE.md)**

Générer les clés : `npx web-push generate-vapid-keys` puis renseigner dans Coolify / `.env.local` :

- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= même clé publique)

## VPS

```powershell
ssh root@187.124.42.135
```

Socat Mandala : port VPS **3307** → conteneur `p11nw75ijqbg4lfzmwbw2m3m`
