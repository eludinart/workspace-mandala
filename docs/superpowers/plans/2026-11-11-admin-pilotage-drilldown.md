# Admin Pilotage drill-down — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Drawer drill-down sur tout le dashboard Pilotage + séries lisibles (chiffres I/J/D) + liens fiche user / lieux / charge / push.

**Architecture:** `buildPilotageDrill` dans `db-admin-pilotage.ts` (ou fichier dédié) ; `GET /api/admin/pilotage/drill` ; UI drawer dans `AdminPilotageTab` + callbacks AdminPage.

**Tech:** Next.js API + MariaDB, `requireAdmin`, `AdminUserSheet`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `next/src/lib/db-admin-pilotage-drill.ts` | Queries drill + normalize kind |
| `next/src/lib/db-admin-pilotage-drill.test.ts` | Helpers kind / titre |
| `next/src/app/api/admin/pilotage/drill/route.ts` | GET |
| `next/src/api/admin.ts` | `pilotageDrill()` |
| `next/src/components/admin/AdminPilotageTab.tsx` | Clics + drawer + séries |
| `next/src/views/AdminPage.tsx` | Props navigation + sheet |

## Tasks

1. Helpers + tests kind/title  
2. SQL drill + route API  
3. UI séries lisibles + drawer + wire clics  
4. AdminPage callbacks  
5. Typecheck + commit push deploy  
