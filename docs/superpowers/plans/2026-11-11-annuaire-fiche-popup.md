# Annuaire fiche popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le panneau latéral desktop de l’annuaire par un popup plein écran partout, et afficher les cartes en grille.

**Architecture:** Réutiliser le portail mobile existant dans `SkillsDirectory.tsx` (retirer `lg:hidden`), supprimer l’article desktop, adapter les effets body/scroll/focus, passer la liste en grille responsive.

**Tech Stack:** Next.js React client component, `createPortal`, Tailwind.

## Global Constraints

- Vocabulaire Mandala : fiche, lieu, annuaire — pas Prairie/Graine.
- Pas de refonte de `SkillFicheContent`.
- Variantes `app` et `public` couvertes par le même composant.

---

### Task 1: Popup plein écran + grille

**Files:**
- Modify: `next/src/components/skills/SkillsDirectory.tsx`
- Spec: `docs/superpowers/specs/2026-11-11-annuaire-fiche-popup-design.md`

**Interfaces:**
- Consumes: `selectedId`, `setSelectedId`, `SkillFicheContent`, `createPortal`, `mobileFicheScrollRef`
- Produces: overlay visible tous breakpoints ; liste en `grid sm:grid-cols-2 xl:grid-cols-3`

- [ ] **Step 1: Body scroll lock + Escape + scroll top (tous breakpoints)**

Remplacer l’effet overflow limité à `max-width: 1023px` par un lock dès que `selectedId` est set. Ajouter un listener `keydown` Escape → `setSelectedId(null)`. Remplacer l’effet scroll/`annuaire-fiche` par un scroll top du conteneur overlay uniquement.

- [ ] **Step 2: Grille de cartes, sans panneau latéral**

Remplacer
`grid … lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]`
par une seule `<ul className="grid … sm:grid-cols-2 xl:grid-cols-3">`.
Supprimer l’`<article id="annuaire-fiche" className="hidden lg:block …">`.
Message « aucune fiche » : `sm:col-span-2 xl:col-span-3`.

- [ ] **Step 3: Portail unique tous écrans**

Retirer `lg:hidden` du portail. Envelopper `SkillFicheContent` dans un conteneur `mx-auto w-full max-w-2xl`. Garder barre Fermer + safe areas.

- [ ] **Step 4: Vérifier manuellement / smoke local si dispo**

Ouvrir Annuaire : clic fiche → popup ; Escape ferme ; resize desktop → grille 2/3.

- [ ] **Step 5: Commit + push + deploy Mandala**

Via `.\scripts\build-and-push.ps1` puis `.\scripts\coolify-deploy.ps1` (UUID `c1kgkqqlagjt9auec0elpsma`).
