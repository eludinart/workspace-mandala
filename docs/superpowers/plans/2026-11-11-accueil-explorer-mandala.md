# Plan — Accueil Explorer Mandala

Spec : `docs/superpowers/specs/2026-11-11-accueil-explorer-mandala-design.md`

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `next/src/lib/skill-profile-visibility.ts` | `hasContent` + `needsExploreProfileNudge` |
| `next/src/lib/skill-profile-visibility.test.ts` | tests règle 1 |
| `next/src/components/home/ExploreMandalaHome.tsx` | UI accueil 0 lieu |
| `next/src/views/HomePage.tsx` | brancher Explore si `!active` |
| `next/src/components/public/PlacePublicCard.tsx` | CTA Rejoindre |
| `next/src/components/landing/PlacesCarousel.tsx` | prop showJoin / onJoin |
| `next/src/components/wall/WallDiscoverSection.tsx` | showJoin, showRelier param |
| `next/src/components/layout/ActivePlaceBar.tsx` | copy Explorer Mandala |

## Tâches

1. Helper + tests règle 1  
2. ExploreMandalaHome (bandeau, étapes, mur, join, nudge)  
3. CTA Rejoindre sur cartes  
4. ActivePlaceBar + HomePage  
5. Vérifier typecheck / tests unitaires
