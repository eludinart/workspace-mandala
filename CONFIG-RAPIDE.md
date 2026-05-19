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

→ dépôt **https://github.com/eludinart/Mandala** (privé). Guide : [docs/GUIDE-DEV-ET-DEPLOI.md](docs/GUIDE-DEV-ET-DEPLOI.md) §6.

## Coolify (prod)

Guide : [docs/COOLIFY-MANDALA-SETUP.md](docs/COOLIFY-MANDALA-SETUP.md)

Variables prod prêtes sur le VPS : `/root/mandala-coolify-production.env` (SSH root, copier dans l’UI Coolify).

## Secrets (hors Git)

- `sync-config.env` — tunnel + MariaDB
- `next/.env.local` — Next dev
- `nogit/` — notes privées

## VPS

```powershell
ssh root@187.124.42.135
```

Socat Mandala : port VPS **3307** → conteneur `p11nw75ijqbg4lfzmwbw2m3m`
