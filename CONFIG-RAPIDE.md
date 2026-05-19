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

- **Pas encore en ligne** — créer : https://github.com/new → `eludinart/workspace-mandala` (privé)
- Puis : `git remote add origin https://github.com/eludinart/workspace-mandala.git` · `git push -u origin main`

## Secrets (hors Git)

- `sync-config.env` — tunnel + MariaDB
- `next/.env.local` — Next dev
- `nogit/` — notes privées

## VPS

```powershell
ssh root@187.124.42.135
```

Socat Mandala : port VPS **3307** → conteneur `p11nw75ijqbg4lfzmwbw2m3m`
