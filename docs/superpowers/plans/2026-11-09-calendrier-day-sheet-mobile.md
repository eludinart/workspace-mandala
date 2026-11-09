# Calendrier day sheet mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur mobile, ouvrir le détail d’un jour calendrier en bottom sheet ~90 % (comme `EventDetailModal`), desktop inchangé.

**Architecture:** Sous `lg`, remplacer le `CalendarDayPanel` inline par un overlay fixe ; réutiliser `variant="sheet"`. Fermeture différenciée simple vs multi. Desktop garde la sidebar sticky.

**Tech Stack:** Next.js (App Router), React client components, Tailwind, patterns existants `EventDetailModal` / `m-sheet-max`.

## Global Constraints

- Viewport sheet : **&lt; `lg`** uniquement ; `lg+` sidebar inchangée.
- Pas de nouvel état `sheetOpen` : le sheet suit `selectedDay != null`.
- Multi : fermer = masquer détail sans vider `selectedDays` ; libellé **« Retour au calendrier »**.
- Simple : fermer = `clearSelection()`.
- Pas de swipe-to-dismiss, pas de nouvelle route, pas de refonte du contenu du panneau.
- Pas de commit sauf demande explicite de l’utilisateur.

## File map

| File | Role |
| --- | --- |
| `next/src/views/CalendarPage.tsx` | Overlay mobile, `closeDaySheet`, Escape, retrait inline |
| `next/src/components/calendar/CalendarDayPanel.tsx` | Prop `closeLabel` optionnelle pour le bouton header |
| `docs/superpowers/specs/2026-11-09-calendrier-day-sheet-mobile-design.md` | Spec source (déjà écrite) |

---

### Task 1: `closeLabel` sur CalendarDayPanel

**Files:**
- Modify: `next/src/components/calendar/CalendarDayPanel.tsx`

**Interfaces:**
- Produces: prop optionnelle `closeLabel?: string` — si `onClose` est fourni, le bouton affiche `closeLabel ?? 'Fermer'`.

- [ ] **Step 1: Ajouter `closeLabel` au destructuring et au type props**

Après `onClose?: () => void`, ajouter `closeLabel?: string`.

- [ ] **Step 2: Utiliser le libellé dans le bouton header**

Remplacer le texte fixe `Fermer` du bouton `onClose` par `{closeLabel ?? 'Fermer'}`.

- [ ] **Step 3: Vérifier TypeScript sur le fichier**

Run (depuis `next/`) : `npx tsc --noEmit --pretty false 2>&1 | Select-String -Pattern "CalendarDayPanel" | Select-Object -First 20`  
Expected: aucune ligne (ou erreurs préexistantes hors ce fichier).

---

### Task 2: Overlay mobile + fermeture dans CalendarPage

**Files:**
- Modify: `next/src/views/CalendarPage.tsx`

**Interfaces:**
- Consumes: `CalendarDayPanel` avec `variant="sheet"`, `onClose`, `closeLabel`
- Produces: `closeDaySheet()` selon la règle multi/simple du spec

- [ ] **Step 1: Ajouter `closeDaySheet`**

Près de `clearSelection` :

```tsx
const closeDaySheet = () => {
  const keepSelection =
    selectedDays.length > 1 || (multiSelect && selectedDays.length >= 1)
  if (keepSelection) {
    setSelectedDay(null)
    setDayDetail(null)
    setActionMsg(null)
    return
  }
  clearSelection()
}
```

- [ ] **Step 2: Escape quand le sheet mobile est ouvert**

```tsx
useEffect(() => {
  if (!selectedDay) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeDaySheet()
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [selectedDay, selectedDays, multiSelect])
```

(Note: `closeDaySheet` peut être `useCallback` avec deps `[selectedDays, multiSelect]` pour éviter stale closures — préférer ça.)

- [ ] **Step 3: Remplacer le panneau `lg:hidden` inline par l’overlay**

Retirer :

```tsx
{panelProps && (
  <div className="lg:hidden">
    <CalendarDayPanel {...panelProps} variant="sidebar" />
  </div>
)}
```

Après le bloc grille / sidebar (toujours dans le return, visible seulement mobile), ajouter :

```tsx
{panelProps && (
  <div
    className="lg:hidden fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-3"
    onClick={closeDaySheet}
    role="dialog"
    aria-modal="true"
    aria-label="Détail du jour"
  >
    <div
      className="w-full max-w-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <CalendarDayPanel
        {...panelProps}
        variant="sheet"
        onClose={closeDaySheet}
        closeLabel={
          selectedDays.length > 1 || (multiSelect && selectedDays.length >= 1)
            ? 'Retour au calendrier'
            : 'Fermer'
        }
      />
    </div>
  </div>
)}
```

La sidebar desktop reste :

```tsx
{panelProps && (
  <div className="hidden lg:block sticky top-[68px]">
    <CalendarDayPanel {...panelProps} variant="sidebar" />
  </div>
)}
```

- [ ] **Step 4: Focus initial sur le bouton Fermer**

Dans `CalendarDayPanel`, si `onClose` est défini, ajouter `ref` + `useEffect` qui focus le bouton close au montage / quand `selectedDay` change — **ou** dans l’overlay, `useEffect` + `querySelector` sur le bouton. Préférer ref sur le bouton dans `CalendarDayPanel` :

```tsx
const closeBtnRef = useRef<HTMLButtonElement>(null)
useEffect(() => {
  if (!onClose) return
  closeBtnRef.current?.focus()
}, [onClose, selectedDay])
```

Attacher `ref={closeBtnRef}` au bouton Fermer.

- [ ] **Step 5: Smoke manuel**

Sur viewport &lt; 1024px (dev tools) : Agenda → tap jour → sheet visible sans scroll ; Fermer / backdrop / Escape ferment ; mode Plusieurs jours → Retour au calendrier garde highlights ; desktop ≥1024 sidebar OK, pas d’overlay.

---

### Task 3: Spec status + vérification build légère

**Files:**
- Modify: `docs/superpowers/specs/2026-11-09-calendrier-day-sheet-mobile-design.md` — `Statut : proposed` → `accepted · implémenté`

- [ ] **Step 1: Mettre à jour le statut du spec**
- [ ] **Step 2: `npx tsc --noEmit` dans `next/`** — corriger uniquement les erreurs introduites par ce changement
