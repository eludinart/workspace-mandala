# Support images + multi-delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow up to 3 screenshots on help/support reports and multi-delete treated reports in Admin → Retours.

**Architecture:** Client compresses images to JPEG data URLs (fit, no crop); API stores them in `mdl_support_report_images`; admin lists them and batch-deletes done reports only (all-or-nothing).

**Tech Stack:** Next.js App Router, MariaDB, existing `compress-feed-image` helpers + HelpButton / AdminSupportTab.

## Global Constraints

- Max 3 images per report; optional; text still required (≥ 8 chars).
- Images for both `question` and `bug`.
- Multi-delete only status `done`.
- Data URLs only (`data:image/`), ~300 Ko decoded target / ~420k char cap each.
- Vocabulaire Mandala (pas Prairie/Graine).

---

### Task 1: Schema + db-support

**Files:**
- Create: `docs/schema/024_mandala_support_images.sql`
- Modify: `next/src/lib/db-support.ts`
- Create: `next/src/lib/support-images.ts` (validate helpers)

- [ ] Ensure images table; insert/list/cascade delete; `deleteDoneSupportReportsBatch(ids)` all-or-nothing

### Task 2: API routes + client

**Files:**
- Modify: `next/src/app/api/support/route.ts` (POST images, DELETE batch)
- Modify: `next/src/app/api/support/[id]/route.ts` (cascade via db)
- Modify: `next/src/api/support.ts`

### Task 3: compressSupportImage

**Files:**
- Modify: `next/src/lib/compress-feed-image.ts` — export `compressSupportImage` (fit, no crop)

### Task 4: HelpButton UI

**Files:**
- Modify: `next/src/components/help/HelpButton.tsx`

### Task 5: AdminSupportTab UI

**Files:**
- Modify: `next/src/components/admin/AdminSupportTab.tsx`
