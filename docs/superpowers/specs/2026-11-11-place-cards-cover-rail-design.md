# Design — Cartes lieux cover + rail horizontal

Date : 2026-11-11  
Statut : accepted · implémentation  
Réf. : Airbnb / Meetup / Eventbrite (cover + méta + CTA) ; rail type mobile Airbnb

## Décision

**A + rail horizontal partout** via `PlacePublicCard` + `PlacesCarousel` (landing, Découvrir, Accueil Explorer).

## Carte

1. Bandeau média ~9:5 — image avatar en cover, sinon dégradé `accent` + emoji centré.  
2. Corps : nom · tagline ou silence · 📍 ville · chips (invitation / membres) · description clamp 2.  
3. CTA : Rejoindre primaire · Voir le profil secondaire.  
4. Pas de `min-h` forcé vide.

## Rail

- Cartes ~85 % largeur, peek de la suivante, `scroll-snap`.  
- Compteur / flèches discrets optionnels ; plus de « une carte pleine largeur vide ».
