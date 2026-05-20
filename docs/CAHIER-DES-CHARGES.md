# Mandala — cahier des charges (bêta)

## Vision produit

Plateforme multi-communautés (Shambhala, Sivanà, …) pour **lieux**, **membres**, **événements** et **messages**.

## Périmètre bêta v0.1

| Module | Fonctionnalités | Statut |
|--------|-----------------|--------|
| Auth | Inscription, login, profil (nom, pseudo, visibilité) | ✅ |
| Communautés | Sélecteur, membership auto, rôles member/organizer/admin | ✅ |
| Membres | Liste prairie, graines, lien messages | ✅ |
| Messages | Clairière P2P, présence, non-lus | ✅ |
| **Événements** | Liste, détail, phases, tâches, équipe (staff) | ✅ |
| Graines entrantes | Accepter / refuser les demandes reçues | À faire |
| Notifications | Centre de notifications | À faire |
| Mur / broadcasts | Annonces admin | À faire |

## Événements — spécification

### Cycle de vie (phases)

1. **Préparation** — planification, tâches amont  
2. **Jour J** — déroulement  
3. **Après** — bilan, rangement  
4. **Clôturé** — archivé  

### Rôles équipe (staff)

- `lead` — responsable  
- `welcome` — accueil  
- `logistics` — logistique  
- `communication` — com  
- `volunteer` — volontaire  

Seuls **organizer** ou **admin** de la communauté (ou admin app) peuvent créer/modifier un événement et gérer l’équipe.

### Écrans

- Liste des événements de la communauté active (tri par date)  
- Détail : description, lieu, dates, phase, liste staff, tâches par phase  
- Ajout d’une personne à l’équipe (membre de la communauté)  
