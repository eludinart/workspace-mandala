# Design — Engagement mur (réactions, commentaires, partage)

Date : 2026-11-06  
Statut : accepted · implémentation

## Problème

Sur Agora, annonces, événements (« Prochain rendez-vous »), les membres ne peuvent ni réagir, ni commenter, ni partager — contrairement au chat (réactions nommées déjà livrées).

## Décision

Trio sous chaque publication cible (`event` | `post` | `announcement`) :

1. **Réactions** — même palette / règle qu’en chat (1 emoji / personne, noms visibles).
2. **Commentaires** — fil plat (pas d’imbrication MVP).
3. **Partage** — deep link + copier / Web Share ; option **envoyer dans une conversation**.

### Accès (option C)

| Action | Qui |
| --- | --- |
| Réagir / commenter | Membres du lieu (+ porte ouverte) |
| Partage externe (lien public) | Contenu `wall_public` ; visiteurs OK sur la page publique |
| Partage interne / vers conversation | Membres du lieu avec accès à la pub |
| Contenu privé partagé | Lien app ; hors session → connexion / rejoindre, sans corps exposé |

### Porte

`mur_engagement` — défaut **administrateurs**. Fermée = UI engagement absente (comportement actuel).

### Vocabulaire UI

Réagir · Commenter · Partager · Copier le lien · Envoyer dans une conversation. Pas like / post / thread.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Réutiliser `chat_message_reactions` | Couplage chat / mur ; clés message_id |
| Commentaires imbriqués dès le MVP | Complexité UI ; `parent_id` préparé pour plus tard |
| Partage sans `wall_public` en clair | Fuite de contenu privé |

## Modèle

- `mdl_content_reactions` — UNIQUE (kind, target_id, user_id)
- `mdl_content_comments` — kind, target_id, author_id, body, parent_id NULL, created_at

Deep links :

- `/lieux/{slug}/evenements/{id}`
- `/lieux/{slug}/annonces/{id}`
- `/lieux/{slug}/agora/{id}`

## Hors scope immédiat

Notifs push dédiées (notif in-app légère à l’auteur du contenu OK), multi-niveau de réponses, édition de commentaires.
