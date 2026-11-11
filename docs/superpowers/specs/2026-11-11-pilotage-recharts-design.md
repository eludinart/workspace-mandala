# Design — Pilotage admin : charts Recharts

Date : 2026-11-11  
Statut : accepted · implémentation

## Décisions

1. **Dashboard visuel (C)** : KPI cards + **2 charts** cliquables.
2. **Lib** : **Recharts** (pas de SVG maison).
3. **Séries journalières** : **chart seul** — plus de liste de lignes I/J/D par jour.
4. Si **tout à 0** : banner existante + chart plat ; pas de liste.

## Structure UI

1. Période 7 / 30 / 90  
2. KPI cards → drill  
3. **Chart Vie du réseau** — lignes I / J / D ; tooltip ; clic → `series_day`  
4. Funnel, lieux, fil d’activité (inchangés)  
5. **Chart Charge** — RPS (tooltip rps/avgMs/errors) ; clic → Charge & alertes  

## Données

- `data.series` et `healthLoad.series` existants — **pas** de nouvel endpoint.

## Fichiers

- `next/package.json` — dépendance `recharts`
- `next/src/components/admin/PilotageSeriesChart.tsx`
- `next/src/components/admin/PilotageLoadChart.tsx`
- `next/src/components/admin/AdminPilotageTab.tsx`

## Vérification

- [ ] Chart I/J/D visible 7/30/90 ; tooltip OK  
- [ ] Clic point → drill jour / métrique  
- [ ] Plus de liste de jours sous le chart  
- [ ] Tout à 0 : banner + chart, pas de lignes vides  
- [ ] Chart charge ; clic → onglet Load  
- [ ] Export CSV séries toujours dispo  
