# Push Receipts Admin Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Accusés `delivered`/`opened` Web Push + panneau admin + alertes seuil/individuelles.

**Architecture:** `push_sends` à l’envoi VAPID ; ack SW HMAC ; APIs admin ; onglet Push + fiche membre ; cron alertes/purge.

**Tech Stack:** Next.js App Router, MariaDB, web-push, service worker.

## Global Constraints

- App admin only pour overview / user / test / alerts UI
- Ack via HMAC (pas de cookie requis)
- Rétention 30 jours
- Vocabulaire Mandala (pas Prairie/Graine)

---

## Task 1: Schema + DB helpers

- Extend `db-push.ts` / new `db-push-receipts.ts`
- Tables `push_sends`, `push_receipts` ; columns subscription `platform`, `standalone`, `last_seen_at`
- HMAC helpers `push-ack-token.ts`

## Task 2: Wire send + SW ack

- `web-push-send.ts` crée sends + payload `sendId`/`sig`
- `POST /api/notifications/push_ack`
- Update `sw.js`

## Task 3: Admin APIs + UI

- overview, user, test_user, check_alerts
- Admin tab Push + AdminUserSheet block
- Critical alert hook on important sends
- Update PUSH-SMARTPHONE.md

## Task 4: Commit push deploy Mandala
