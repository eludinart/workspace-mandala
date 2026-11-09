# Design — Calendrier : détail jour en bottom sheet (mobile)

Date : 2026-11-09  
Statut : accepted · implémenté

## Problème

Sur smartphone, après sélection d’une date dans l’Agenda, le bloc d’informations / actions (`CalendarDayPanel`) s’affiche **sous** la grille. L’utilisateur doit scroller pour voir présence, événements et outils de gestion — frein UX important sur un écran déjà rempli (légende, réglages, grille).

Desktop (`lg+`) : sidebar sticky à droite — comportement correct, hors scope.

## Décision

Sur viewport **&lt; `lg`**, ouvrir le détail jour en **bottom sheet ~90 %** (fond assombri), calqué sur `EventDetailModal`. Desktop inchangé. Variante `sheet` déjà présente sur `CalendarDayPanel` mais non branchée.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Scroll auto vers le panneau inline | Moins disruptif mais le calendrier reste au-dessus ; l’action principale reste hors viewport initial |
| Plein écran vrai (100 %) | Plus immersif, moins de « sortie » visuelle ; le fond cliquable du sheet ~90 % est plus cohérent avec le reste de l’app |
| Route / page jour dédiée | Trop lourd ; casse le multi-jours et l’historique inutile ici |
| Sheet hors multi, inline en multi | L’utilisateur a demandé le sheet aussi en multi, avec retour clair au calendrier |

## Comportement cible

1. **Déclencheur** : dès que `selectedDay != null` sous `lg`, l’overlay s’ouvre. Pas d’état `sheetOpen` séparé.
2. **Apparence** : `fixed inset-0 z-[70]` (au-dessus du FAB aide), fond `bg-black/70` cliquable, sheet bas `m-sheet-max m-above-os-chrome` avec `max-height` en `calc(var(--vvh) - 1.5rem)` **sans** `min(100%, …)` (sinon hauteur parent auto → sheet hors viewport), scroll interne sur le corps, `role="dialog"` `aria-modal="true"`.
3. **Contenu** : `CalendarDayPanel` en `variant="sheet"` avec `onClose` branché.
4. **Fermetures** :
   - Bouton header, tap backdrop, touche Escape.
   - **Sélection simple** (`selectedDays.length ≤ 1`) : fermer = `clearSelection()` (plus de détail, plus de highlight).
   - **Multi** (`selectedDays.length > 1` **ou** mode « Plusieurs jours » actif avec au moins un jour) : fermer = masquer le détail (`selectedDay` + `dayDetail` → null) **sans** vider `selectedDays` / `anchorDay` / `multiSelect`. Libellé bouton : **« Retour au calendrier »**.
5. **Réouverture** : retaper un jour (ou un chip « prochains jours ») rappelle `openDay` → sheet réapparaît.
6. **Desktop** : grille + sidebar sticky ; aucun overlay.
7. **Retrait** : le panneau inline `lg:hidden` sous la grille disparaît.

## Architecture

### Fichiers

- `next/src/views/CalendarPage.tsx` — overlay mobile, handlers de fermeture différenciés, retrait inline.
- `next/src/components/calendar/CalendarDayPanel.tsx` — libellé du bouton close selon contexte multi ; éventuellement prop `closeLabel` pour rester déclaratif.

### Handlers (CalendarPage)

```text
closeDaySheet()
  si multi actif (selectedDays.length > 1 || (multiSelect && selectedDays.length >= 1))
    → setSelectedDay(null); setDayDetail(null); setActionMsg(null)
  sinon
    → clearSelection()
```

Passer `onClose={closeDaySheet}` au panneau sheet mobile uniquement. La sidebar desktop n’a pas besoin de Fermer (pas d’`onClose` aujourd’hui).

### Accessibilité & focus

- Dialog modal : Escape ferme.
- Au montage du sheet : focus sur le bouton Fermer / Retour (ou le conteneur dialog avec `tabIndex={-1}`).
- Au démontage : pas d’obligation de restaurer le focus sur la cellule (grille non focusable aujourd’hui) — acceptable.

### Edge cases

- Changement de lieu (`active.slug`) : reset existant déjà — sheet disparaît.
- Pull-to-refresh / bus événements : si `selectedDay` encore set, `openDay` recharge ; sheet reste ouvert.
- Mode multi sans jour encore choisi : pas de sheet (`selectedDay` null).
- `actionMsg` : visible dans la page sous l’overlay seulement si le sheet est fermé ; si un message doit rester utile pendant le sheet, le garder aussi dans le flux du panneau (déjà partiellement via états du panneau) — **ne pas bloquer** sur un bandeau global sous l’overlay.

## Hors scope

- Swipe-to-dismiss, animations custom.
- Changement du layout desktop.
- Nouvelle route ou deep-link jour.
- Refonte du contenu du `CalendarDayPanel`.

## Critères de succès

1. Mobile : tap jour → sheet visible sans scroller ; actions (présence / gestion) immédiatement accessibles.
2. Fermer / backdrop / Escape ramènent à la grille.
3. Multi : « Retour au calendrier » conserve la sélection sur la grille ; retap rouvre le sheet.
4. Desktop : comportement sidebar inchangé.
5. Pas de panneau doublon sous la grille sur mobile.
