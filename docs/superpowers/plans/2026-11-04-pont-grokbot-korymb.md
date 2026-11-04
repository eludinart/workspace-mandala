# Pont Grokbot ↔ Korymb / Hermes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un canal `agent_bus` sur l’API Korymb pour que Cursor, Hermes, Grokbot (HTTP) et Grok s’échangent des messages sans polluer l’inbox HITL.

**Architecture:** Table MariaDB/SQLite `agent_bus_messages` + service + router FastAPI authentifié par `X-Agent-Secret`. Hermes étend `korymb-api-bridge` ; Cursor étend `korymb-mission-bridge` ; Grokbot consomme les mêmes endpoints via outil HTTP.

**Tech Stack:** FastAPI, pytest + TestClient, scripts bash/ps1 existants, skills Hermes/Cursor Markdown.

**Spec:** `docs/superpowers/specs/2026-11-04-pont-grokbot-korymb-design.md` (repo Mandala).  
**Code API :** travailler dans le repo **Korymb** (`c:\Users\eludi\korymb`), pas Mandala.

## Global Constraints

- Auth uniquement `X-Agent-Secret` (pas de secret dans git).
- Les messages `agent_bus` **n’apparaissent pas** dans `/admin/inbox` Décisions.
- Nœuds autorisés : `cursor` | `grokbot` | `hermes` | `grok` ; `to` peut aussi être `*`.
- Status : `open` | `acked` | `done`.
- YAGNI : pas d’UI Korymb, pas d’Adapter, pas de secret multi-agents en v1.
- Tests : TDD, `pytest` backend Korymb avec fixture `client`.

## File map

| Fichier (Korymb sauf mention) | Rôle |
| --- | --- |
| `backend/services/agent_bus.py` | Table, create/list/ack/done |
| `backend/routers/core_agent_bus.py` | Routes HTTP |
| `backend/main.py` | `include_router` |
| `backend/database.py` | Appel `init_agent_bus_tables` au boot |
| `backend/tests/test_agent_bus.py` | Tests API |
| `ops/hermes-skills/korymb-api-bridge/SKILL.md` | Doc endpoints bus |
| `ops/hermes-skills/eludein-agent-bus/SKILL.md` | Poll + Telegram |
| `.cursor/skills/korymb-mission-bridge/SKILL.md` | Section Cursor |
| `docs/AGENT-BUS-GROKBOT.md` | Config outil HTTP Grok Bot |
| Mandala `.cursor/skills/korymb-mission-bridge/SKILL.md` | Miroir section bus (si présent) |

---

### Task 1: Service `agent_bus` + tests API (TDD)

**Files:**
- Create: `backend/services/agent_bus.py`
- Create: `backend/routers/core_agent_bus.py`
- Create: `backend/tests/test_agent_bus.py`
- Modify: `backend/main.py` (include router)
- Modify: `backend/database.py` (init tables près de `init_action_tables`)

**Interfaces:**
- Produces: `init_agent_bus_tables() -> None`
- Produces: `create_message(*, from_node: str, to_node: str, topic: str, body: str, reply_to: str | None = None) -> dict`
- Produces: `list_messages(*, to_node: str | None = None, from_node: str | None = None, topic: str | None = None, status: str | None = "open", limit: int = 50) -> list[dict]`
- Produces: `ack_message(message_id: str) -> dict`
- Produces: `done_message(message_id: str, comment: str = "") -> dict`
- Produces: HTTP `POST /agent-bus/messages`, `GET /agent-bus/messages`, `POST /agent-bus/messages/{id}/ack`, `POST /agent-bus/messages/{id}/done`

- [ ] **Step 1: Write the failing tests**

Créer `backend/tests/test_agent_bus.py` :

```python
"""Canal agent_bus — messages inter-nœuds hors inbox HITL."""
from __future__ import annotations


def test_create_and_list_open_for_grokbot(client):
    created = client.post(
        "/agent-bus/messages",
        json={
            "from": "cursor",
            "to": "grokbot",
            "topic": "mandala-play-review",
            "body": "Surveiller validation Play Store.",
        },
    )
    assert created.status_code == 200, created.text
    msg = created.json()
    assert msg["id"].startswith("bus-")
    assert msg["status"] == "open"
    assert msg["from"] == "cursor"
    assert msg["to"] == "grokbot"

    listed = client.get("/agent-bus/messages", params={"to": "grokbot", "status": "open"})
    assert listed.status_code == 200
    ids = [m["id"] for m in listed.json()["messages"]]
    assert msg["id"] in ids


def test_ack_then_done(client):
    created = client.post(
        "/agent-bus/messages",
        json={
            "from": "cursor",
            "to": "hermes",
            "topic": "smoke",
            "body": "ping",
        },
    ).json()
    mid = created["id"]

    acked = client.post(f"/agent-bus/messages/{mid}/ack")
    assert acked.status_code == 200
    assert acked.json()["status"] == "acked"

    done = client.post(
        f"/agent-bus/messages/{mid}/done",
        json={"comment": "pong"},
    )
    assert done.status_code == 200
    body = done.json()
    assert body["status"] == "done"
    assert "pong" in (body.get("comment") or "")


def test_rejects_unknown_node(client):
    bad = client.post(
        "/agent-bus/messages",
        json={"from": "chatgpt", "to": "cursor", "topic": "x", "body": "nope"},
    )
    assert bad.status_code == 400


def test_agent_bus_not_in_hitl_inbox(client):
    client.post(
        "/agent-bus/messages",
        json={
            "from": "cursor",
            "to": "grokbot",
            "topic": "no-inbox",
            "body": "ne doit pas polluer Décisions",
        },
    )
    inbox = client.get("/admin/inbox")
    assert inbox.status_code == 200
    items = inbox.json().get("items") or []
    assert not any(
        "no-inbox" in str(i.get("title") or "") or "ne doit pas polluer" in str(i.get("body") or "")
        for i in items
    )
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
cd c:\Users\eludi\korymb\backend
python -m pytest tests/test_agent_bus.py -v
```

Expected: FAIL (404 ou import manquant sur `/agent-bus/messages`).

- [ ] **Step 3: Implement `backend/services/agent_bus.py`**

```python
"""Bus messages inter-agents (Cursor / Hermes / Grokbot / Grok) — hors HITL."""
from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any

from database import LONG_TEXT_CHARS, _is_mariadb, get_conn, _ws

ALLOWED_NODES = frozenset({"cursor", "grokbot", "hermes", "grok"})
ALLOWED_TO = ALLOWED_NODES | {"*"}
ALLOWED_STATUS = frozenset({"open", "acked", "done"})


def init_agent_bus_tables() -> None:
    text_pk = "VARCHAR(191)" if _is_mariadb() else "TEXT"
    body_type = "LONGTEXT" if _is_mariadb() else "TEXT"
    with get_conn() as conn:
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS agent_bus_messages (
                id            {text_pk} PRIMARY KEY,
                workspace_id  {text_pk} NOT NULL,
                from_node     TEXT NOT NULL,
                to_node       TEXT NOT NULL,
                topic         TEXT NOT NULL,
                body          {body_type} NOT NULL,
                status        TEXT NOT NULL DEFAULT 'open',
                reply_to      TEXT,
                comment       TEXT NOT NULL DEFAULT '',
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            )
        """)
        conn.commit()


def _now() -> str:
    return datetime.utcnow().isoformat()


def _new_id() -> str:
    return f"bus-{secrets.token_hex(6)}"


def _row_to_dict(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "from": row["from_node"],
        "to": row["to_node"],
        "topic": row["topic"],
        "body": row["body"],
        "status": row["status"],
        "reply_to": row.get("reply_to"),
        "comment": row.get("comment") or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_message(
    *,
    from_node: str,
    to_node: str,
    topic: str,
    body: str,
    reply_to: str | None = None,
) -> dict:
    fr = (from_node or "").strip().lower()
    to = (to_node or "").strip().lower()
    topic_clean = (topic or "").strip()[:128]
    body_clean = (body or "").strip()[:LONG_TEXT_CHARS]
    if fr not in ALLOWED_NODES:
        raise ValueError(f"from invalide: {from_node}")
    if to not in ALLOWED_TO:
        raise ValueError(f"to invalide: {to_node}")
    if not topic_clean:
        raise ValueError("topic requis")
    if not body_clean:
        raise ValueError("body requis")
    mid = _new_id()
    now = _now()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO agent_bus_messages "
            "(id, workspace_id, from_node, to_node, topic, body, status, reply_to, comment, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 'open', ?, '', ?, ?)",
            (mid, _ws(), fr, to, topic_clean, body_clean, reply_to, now, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM agent_bus_messages WHERE id=?", (mid,)
        ).fetchone()
    return _row_to_dict(dict(row))  # type: ignore[arg-type]


def list_messages(
    *,
    to_node: str | None = None,
    from_node: str | None = None,
    topic: str | None = None,
    status: str | None = "open",
    limit: int = 50,
) -> list[dict]:
    clauses = ["workspace_id = ?"]
    params: list[Any] = [_ws()]
    if to_node:
        clauses.append("to_node = ?")
        params.append(to_node.strip().lower())
    if from_node:
        clauses.append("from_node = ?")
        params.append(from_node.strip().lower())
    if topic:
        clauses.append("topic = ?")
        params.append(topic.strip()[:128])
    if status:
        st = status.strip().lower()
        if st not in ALLOWED_STATUS:
            raise ValueError(f"status invalide: {status}")
        clauses.append("status = ?")
        params.append(st)
    lim = max(1, min(int(limit or 50), 200))
    sql = (
        "SELECT * FROM agent_bus_messages WHERE "
        + " AND ".join(clauses)
        + " ORDER BY created_at DESC LIMIT ?"
    )
    params.append(lim)
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [_row_to_dict(dict(r)) for r in rows]  # type: ignore[misc]


def _set_status(message_id: str, status: str, comment: str = "") -> dict:
    if status not in ALLOWED_STATUS:
        raise ValueError(f"status invalide: {status}")
    now = _now()
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE agent_bus_messages SET status=?, comment=CASE WHEN ? != '' THEN ? ELSE comment END, "
            "updated_at=? WHERE id=? AND workspace_id=?",
            (status, comment, comment[:LONG_TEXT_CHARS], now, message_id, _ws()),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise KeyError(message_id)
        row = conn.execute(
            "SELECT * FROM agent_bus_messages WHERE id=?", (message_id,)
        ).fetchone()
    return _row_to_dict(dict(row))  # type: ignore[arg-type]


def ack_message(message_id: str) -> dict:
    return _set_status(message_id, "acked")


def done_message(message_id: str, comment: str = "") -> dict:
    return _set_status(message_id, "done", comment=comment or "")
```

- [ ] **Step 4: Implement `backend/routers/core_agent_bus.py`**

```python
"""API agent_bus — messages inter-nœuds second cerveau."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from auth import require_admin
from database import LONG_TEXT_CHARS
from services import agent_bus

router = APIRouter(prefix="/agent-bus", tags=["agent-bus"])


class MessageCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    from_node: str = Field(..., alias="from", min_length=2, max_length=32)
    to_node: str = Field(..., alias="to", min_length=1, max_length=32)
    topic: str = Field(..., min_length=1, max_length=128)
    body: str = Field(..., min_length=1, max_length=LONG_TEXT_CHARS)
    reply_to: str | None = Field(None, max_length=64)


class MessageDoneBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: str = Field("", max_length=LONG_TEXT_CHARS)


@router.post("/messages", dependencies=[Depends(require_admin)])
def messages_create(body: MessageCreateBody):
    try:
        return agent_bus.create_message(
            from_node=body.from_node,
            to_node=body.to_node,
            topic=body.topic,
            body=body.body,
            reply_to=body.reply_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/messages", dependencies=[Depends(require_admin)])
def messages_list(
    to: str | None = Query(None),
    from_node: str | None = Query(None, alias="from"),
    topic: str | None = Query(None),
    status: str | None = Query("open"),
    limit: int = Query(50, ge=1, le=200),
):
    try:
        return {
            "messages": agent_bus.list_messages(
                to_node=to,
                from_node=from_node,
                topic=topic,
                status=status,
                limit=limit,
            )
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/messages/{message_id}/ack", dependencies=[Depends(require_admin)])
def messages_ack(message_id: str):
    try:
        return agent_bus.ack_message(message_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Message introuvable.") from None


@router.post("/messages/{message_id}/done", dependencies=[Depends(require_admin)])
def messages_done(message_id: str, body: MessageDoneBody | None = None):
    try:
        return agent_bus.done_message(message_id, comment=(body.comment if body else ""))
    except KeyError:
        raise HTTPException(status_code=404, detail="Message introuvable.") from None
```

- [ ] **Step 5: Wire router + init**

Dans `backend/main.py`, près des autres imports `core_*` :

```python
from routers.core_agent_bus import router as core_agent_bus_router
```

et :

```python
app.include_router(core_agent_bus_router)
```

Dans `backend/database.py`, juste après l’appel à `init_action_tables()` :

```python
from services.agent_bus import init_agent_bus_tables
init_agent_bus_tables()
```

(garder le même style try/import local que pour `action_queue` si c’est le pattern du fichier).

- [ ] **Step 6: Run tests — expect PASS**

```powershell
cd c:\Users\eludi\korymb\backend
python -m pytest tests/test_agent_bus.py -v
```

Expected: 4 passed.

- [ ] **Step 7: Commit (repo Korymb)**

```powershell
cd c:\Users\eludi\korymb
git add backend/services/agent_bus.py backend/routers/core_agent_bus.py backend/tests/test_agent_bus.py backend/main.py backend/database.py
git commit -m "feat(agent-bus): canal messages inter-nœuds hors HITL"
```

---

### Task 2: Skills Cursor + Hermes + doc Grokbot

**Files:**
- Modify: `ops/hermes-skills/korymb-api-bridge/SKILL.md`
- Create: `ops/hermes-skills/eludein-agent-bus/SKILL.md`
- Modify: `.cursor/skills/korymb-mission-bridge/SKILL.md` (Korymb)
- Create: `docs/AGENT-BUS-GROKBOT.md` (Korymb)
- Modify (si présent): `c:\workspace-mandala\.cursor\skills\korymb-mission-bridge\SKILL.md`

**Interfaces:**
- Consumes: endpoints Task 1
- Produces: doc outil HTTP Grok Bot + skills à déployer via `hermes-intelligence-deploy`

- [ ] **Step 1: Étendre `korymb-api-bridge`**

Ajouter dans le tableau GET :

| `/agent-bus/messages?to=hermes&status=open` | Messages bus destinés à Hermes |

Ajouter dans écritures autorisées :

| Poster un message bus | `POST /agent-bus/messages` + JSON `from/to/topic/body` |
| Ack | `POST /agent-bus/messages/{id}/ack` |
| Done | `POST /agent-bus/messages/{id}/done` + `{"comment":"..."}` |

- [ ] **Step 2: Créer `ops/hermes-skills/eludein-agent-bus/SKILL.md`**

```markdown
---
name: eludein-agent-bus
category: devops
description: Poll le bus Korymb agent_bus ; notifier Telegram les messages to=hermes ou to=* ; ne pas done les messages destinés à grokbot/cursor.
---

# Agent bus Élude

## Quand

À chaque briefing / alerte, ou sur demande « messages bus ».

## Faire

1. `korymb-api.sh GET '/agent-bus/messages?to=hermes&status=open'`
2. `korymb-api.sh GET '/agent-bus/messages?to=*&status=open'`
3. Résumer sur Telegram (chat ops) : topic + from + extrait body + id
4. Si le message te demande une action ops readonly : exécuter, puis `done` avec comment
5. **Ne pas** `done` un message `to=grokbot` ou `to=cursor`

## Ne pas faire

- Valider HITL `/actions/{id}/resolve`
- Poster des secrets dans le body bus
```

- [ ] **Step 3: Section Cursor dans `korymb-mission-bridge`**

Ajouter :

```markdown
## Agent bus (Cursor ↔ Grokbot / Hermes)

```powershell
.\scripts\korymb-api.ps1 -Method POST -Path /agent-bus/messages -Body @{
  from = "cursor"; to = "grokbot"; topic = "mandala-play-review"
  body = "..."
}
.\scripts\korymb-api.ps1 -Method GET -Path "/agent-bus/messages?to=cursor&status=open"
```

`from` doit être `cursor`. Ne pas utiliser ce canal pour des envois e-mail/social (rester sur `/actions` HITL).
```

Miroir minimal dans Mandala si le skill y existe.

- [ ] **Step 4: Doc Grokbot `docs/AGENT-BUS-GROKBOT.md`**

Contenu minimal :

- Base URL `https://api-korymb.eludein.art`
- Header `X-Agent-Secret: <même secret agent>`
- Outils à créer dans Grok Bot :
  1. `bus_list` → `GET /agent-bus/messages?to=grokbot&status=open`
  2. `bus_post` → `POST /agent-bus/messages` (`from=grokbot`)
  3. `bus_ack` / `bus_done`
- Instruction agent : « Tu es le nœud `grokbot` ; poll open ; exécute ; done avec résultat. »
- Secret hors git (config app uniquement).

- [ ] **Step 5: Commit (Korymb)**

```powershell
cd c:\Users\eludi\korymb
git add ops/hermes-skills/korymb-api-bridge/SKILL.md ops/hermes-skills/eludein-agent-bus docs/AGENT-BUS-GROKBOT.md .cursor/skills/korymb-mission-bridge/SKILL.md
git commit -m "docs(agent-bus): skills Hermes/Cursor + config Grokbot HTTP"
```

Si Mandala modifié :

```powershell
cd c:\workspace-mandala
git add .cursor/skills/korymb-mission-bridge/SKILL.md docs/superpowers/specs/2026-11-04-pont-grokbot-korymb-design.md docs/superpowers/plans/2026-11-04-pont-grokbot-korymb.md
git commit -m "docs: pont Grokbot Korymb — spec + plan + skill"
```

---

### Task 3: Deploy + smoke (avec accord Éric)

**Files:** aucun code nouveau — Coolify back Korymb + sync Hermes.

- [ ] **Step 1: Demander accord explicite** avant push/deploy prod Korymb back.

- [ ] **Step 2: Push + deploy** service API Korymb (Coolify), selon runbook repo.

- [ ] **Step 3: Smoke**

```powershell
# depuis machine avec KORYMB_AGENT_SECRET
.\scripts\korymb-api.ps1 -Method GET -Path /health
.\scripts\korymb-api.ps1 -Method POST -Path /agent-bus/messages -Body '{
  "from":"cursor","to":"hermes","topic":"smoke","body":"ping agent-bus"
}'
.\scripts\korymb-api.ps1 -Method GET -Path "/agent-bus/messages?to=hermes&status=open"
```

Expected: message `bus-…` listé ; `/admin/inbox` inchangé pour ce topic.

- [ ] **Step 4: Sync Hermes skills**

```powershell
.\scripts\hermes-intelligence-deploy.ps1
```

(ou équivalent documenté) pour pousser `eludein-agent-bus` + bridge mis à jour.

- [ ] **Step 5: Config manuelle Grok Bot**

Suivre `docs/AGENT-BUS-GROKBOT.md` avec Éric (secret déjà connu côté Hermes/Cursor).

- [ ] **Step 6: Aller-retour**

1. Cursor poste `to=grokbot` topic `mandala-play-review` (suivi Play Store).
2. Grokbot liste, ack, done.
3. Cursor `GET ?to=cursor` ou `from=grokbot&status=done` selon convention choisie au moment du done (si besoin d’une réponse, Grokbot `POST` un nouveau message `to=cursor`).

---

## Spec coverage (self-review)

| Spec | Task |
| --- | --- |
| API `/agent-bus/messages` + ack/done | Task 1 |
| Hors inbox HITL | Task 1 test `test_agent_bus_not_in_hitl_inbox` |
| Nœuds cursor/grokbot/hermes/grok + `*` | Task 1 `ALLOWED_*` |
| Skills Cursor / Hermes | Task 2 |
| Grokbot HTTP (A) | Task 2 doc + Task 3 config |
| Deploy / smoke | Task 3 |
| Adapter / Slack / UI | hors scope — non planifié |

## Placeholder scan

Aucun TBD / « implement later » dans les steps code.
