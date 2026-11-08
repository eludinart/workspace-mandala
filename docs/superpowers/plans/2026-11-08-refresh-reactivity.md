# Refresh réactif — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** App Mandala réactive, sans flash inter-lieux, avec feedback clair du lieu actif et cache partagé événements.

**Architecture:** QueryClient dans `AppProviders` ; hooks `usePlaceEvents` ; invalidation via helpers ; clear-on-switch sur Agora/Annonces/Calendar ; `setActiveSlug(..., { notify: true })` au switch manuel ; `refresh({ background })`.

**Tech Stack:** Next 15, React 18, `@tanstack/react-query`, APIs existantes `eventsApi` / `communitiesApi`.

---

### Task 1: Spec + Query foundation

- [ ] Install `@tanstack/react-query`
- [ ] Provider + query keys + `usePlaceEvents` + `invalidatePlaceEvents`
- [ ] Wire HomePage + EventsPage

### Task 2: Isolation lieu + feedback

- [ ] AgoraFeed / PlaceAnnouncementsSection / CalendarPage clear on slug change
- [ ] CommunitySwitcher notify ; refresh background
- [ ] Emit `mandala-events-changed` on Events create

### Task 3: Verify

- [ ] `npm run typecheck` in `next/`
