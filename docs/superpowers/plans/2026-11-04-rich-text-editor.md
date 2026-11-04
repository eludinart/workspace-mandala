# Rich Text Editor Implementation Plan

> **For agentic workers:** implemented in-session 2026-11-04.

**Goal:** Éditeur WYSIWYG TipTap réutilisable ; première intégration = charte du lieu.

**Architecture:** `RichTextEditor` / `RichTextViewer` + HTML sanitizé ; charte stockée `{format:'html',html}` avec migration lecture des blocs legacy.

**Tech Stack:** TipTap 3, sanitize-html, Next 15.

## Done

- [x] Helpers `parseCharterToHtml` / `serializeCharterHtml` / sanitize
- [x] Composants `components/editor/*`
- [x] Charte UI + API/DB en HTML
- [x] Tests + typecheck
