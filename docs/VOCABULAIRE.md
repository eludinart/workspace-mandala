# Vocabulaire Mandala

> **Décision (2026-11-01) :** à l’écran, Mandala parle **lien, message, conversation, lieu, lieu ami, membre**.  
> Le jargon jardin hérité de Fleur d’AmOurs (Prairie, Graine, Clairière, Lisière, Fleur, pollen…) **ne s’affiche plus**.  
> Source produit : `docs/SUITE.md` § Règles.

## Mapping

| Ancien (Fleur / code legacy) | À l’écran Mandala | Notes techniques (peuvent rester en interne) |
|---|---|---|
| Prairie / Grand Jardin | — (pas de nom magique) ; **liens** entre personnes | tables `prairie_links`, routes `/api/prairie/*` |
| Graine | **demande de lien** / **demande** | `social_seeds`, `send_seed` (souvent retiré) |
| Accepter une graine | **Accepter** (la demande) | |
| Clairière | **Messages** / **conversation** | `chat_channels`, comments « Clairière » |
| Lisière | **profil** / fiche personne | `visit_lisiere` |
| Fleur (carte membre) | **membre** / fiche | `getFleurs`, `/fleurs` |
| Jardinier #n | **Membre #n** ou pseudo | fallbacks d’affichage |
| Lieu / communauté | **lieu** | `communities` |
| *(nouveau)* lieu relié | **lieu ami** | chantiers Suite `lieux_lies` |

## Règles pour agents et UI

1. **Copy utilisateur** : jamais Prairie, Graine, Clairière, Lisière, Grand Jardin, Jardinier, arroser, pollen, rosée.
2. **Code / SQL / chemins API** : renommer seulement quand un chantier le justifie ; documenter l’alias ici. Pas de big-bang de migration tables pour le vocabulaire seul.
3. **Docs agents** (`MANDALA-ETAT…`, skills) : glossaire produit = colonnes de droite ; l’ancien terme n’apparaît que comme « legacy code ».
4. **Lieux amis** : vocabulaire de la Suite (`Relier`, `lieu ami`, `Ailleurs`) — pas « réseau Prairie inter-communautés ».

## État produit (hors vocabulaire)

Aujourd’hui chaque **lieu** vit surtout dans son coin (membres, messages, événements du lieu actif).  
Les chantiers Suite (porte → relier → dates / ressources ouvertes → traits carte) construisent les **liens entre lieux**. Tant que la porte `lieux_lies` est fermée, rien de visible pour les non-admins.
