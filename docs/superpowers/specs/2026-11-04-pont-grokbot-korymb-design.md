# Design — Pont Grok / Grokbot ↔ Korymb / Hermes (second cerveau)

Date : 2026-11-04  
Statut : accepted · plan  
Choix validés : hub **Korymb/Hermes** · branchement Grokbot **A** (HTTP direct)

## Problème

Cursor et Grok Bot (Grokbot / agents desktop) ne peuvent pas s’échanger de consignes sans Éric comme relais manuel. Adapter Mind (mémoire partagée Cursor↔Grok) est en file d’attente d’accès manuel — on ne peut pas en dépendre. Le second cerveau Élude (Cursor × Hermes × Korymb) existe déjà mais **Grok / Grokbot n’y sont pas**.

Cas déclencheur : « demande à Grokbot de surveiller la validation Play Store Mandala » — impossible en direct depuis Cursor.

## Décision

1. **Hub** : API Korymb (`https://api-korymb.eludein.art`), auth `X-Agent-Secret` (même famille que Hermes / scripts Cursor).
2. **Observateur** : Hermes poll + notification Telegram (skills existantes étendues).
3. **Grokbot → Korymb** : outil / webhook **HTTP natif** dans Grok Bot (choix **A**), pas de relais Slack.
4. **Grok** (API / chat hors desktop) : même contrat HTTP quand utilisé comme nœud.
5. **Adapter** : hors scope v1 (réévaluer quand l’accès early est accordé).

## Approches écartées

| Option | Pourquoi non (v1) |
| --- | --- |
| Adapter Mind seul | Accès early non encore accordé ; auth MCP Cursor bloquée |
| Canal Slack `#cursor-grok` | Rapide mais hors second cerveau ; doublon à migrer plus tard |
| Relais Hermes seul (choix B) | Pas de canal machine↔machine ; Éric ou collages UI restent nécessaires |
| Réutiliser `POST /actions` HITL tels quels | Pollue `/inbox` Décisions (approve/reject) avec du chatter agents |

## Contrat message (`agent_bus`)

Canal dédié — **pas** un ticket d’envoi HITL.

Champs :

| Champ | Rôle |
| --- | --- |
| `id` | UUID |
| `from` | `cursor` \| `grokbot` \| `hermes` \| `grok` |
| `to` | même enum, ou `*` (broadcast ops) |
| `topic` | slug court (`mandala-play-review`, …) |
| `body` | Markdown court |
| `status` | `open` \| `acked` \| `done` |
| `reply_to` | id parent optionnel |
| `created_at` / `updated_at` | ISO |

Exemple Play Store :

```json
{
  "from": "cursor",
  "to": "grokbot",
  "topic": "mandala-play-review",
  "body": "Envoi #1 Play Console Mandala — 12 mods, état En cours d'examen depuis 2026-11-04 16:28. Surveiller Console/email ; poster `done` ici quand validé ou rejeté."
}
```

## API Korymb (à ajouter)

Auth : `X-Agent-Secret` (+ `X-Workspace-Id` si multi-tenant, défaut legacy comme Hermes).

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `POST` | `/agent-bus/messages` | Déposer un message |
| `GET` | `/agent-bus/messages` | Lister (`to`, `from`, `topic`, `status`, `limit`) |
| `POST` | `/agent-bus/messages/{id}/ack` | Marquer `acked` |
| `POST` | `/agent-bus/messages/{id}/done` | Marquer `done` (+ `comment` optionnel) |

Implémentation : table `agent_bus_messages` (MariaDB Korymb), router FastAPI dédié, **aucune** entrée automatique dans l’inbox HITL Décisions.

Lecture seule Hermes OK via script `korymb-api.sh` une fois les routes exposées.

## Branchement Grokbot (A)

1. Dans Grok Bot : outil custom HTTP (ou équivalent « webhook tool ») :
   - Base URL `https://api-korymb.eludein.art`
   - Header `X-Agent-Secret: <secret>` (stocké hors git, côté config Grok Bot)
   - Actions mappées : `list open for me`, `post`, `ack`, `done`
2. Agent dédié ou instruction Layl / agent ops : « Tu es nœud `grokbot` du second cerveau ; poll `to=grokbot&status=open` ; exécute ; `done` avec résultat. »
3. Secret : soit le même `AGENT_API_SECRET` (simple v1), soit une clé dédiée `grokbot` si Korymb gagne des secrets multi-agents (phase 2).

**Grok** (hors desktop) : même outil HTTP si l’environnement le permet ; sinon report phase 2.

## Branchement Cursor

- Étendre skill `korymb-mission-bridge` (repos Mandala + Korymb) : section **agent-bus**.
- Scripts `korymb-api.ps1` / `.sh` : exemples `POST/GET /agent-bus/messages`.
- Template court `tronc/templates/agent-bus-message.md` (from/to/topic/body).

## Branchement Hermes

- Skill `korymb-api-bridge` ou nouvelle `eludein-agent-bus` : poll messages `open` (surtout `to=hermes` ou `*`), résumé Telegram.
- Ne pas auto-`done` les messages destinés à Grokbot/Cursor.
- Smoke post-deploy : health + un GET agent-bus (liste vide OK).

## Phases

| Phase | Livrable |
| --- | --- |
| **1** | API + table `agent_bus` dans Korymb ; deploy Coolify back |
| **2** | Skills/scripts Cursor + Hermes ; smoke |
| **3** | Config outil HTTP Grok Bot + test aller-retour Cursor → Grokbot → done |
| **4** | (Optionnel) secret agent dédié ; Grok API ; rétrospection Adapter si accès early |

## Hors scope v1

- Adapter Mind / MCP Adapter
- Slack comme bus
- `POST /run` missions coûteuses
- Validation HITL d’envois e-mail/social via ce canal
- UI web Korymb dédiée (liste API + Telegram suffisent)

## Vérification

- `GET /health` OK ; `POST` message Cursor → visible `GET` avec `to=grokbot`.
- Hermes reçoit une notif Telegram sur message `to=hermes` ou broadcast test.
- Grokbot outil HTTP : liste ses `open`, répond `done` ; Cursor relit `status=done`.
- Aucun nouveau ticket dans `/inbox` Décisions pour un message agent-bus.
- Aucun secret dans git.

## Risques

| Risque | Mitigation |
| --- | --- |
| Grok Bot n’expose pas d’outil HTTP custom | Repli temporaire B (Hermes relais) documenté ; ne pas bloquer phases 1–2 |
| Secret partagé trop large | Phase 4 : secret dédié + audit `source` |
| Bruit Telegram | Filtrer : notifier seulement `to=hermes` ou topics allowlist |
