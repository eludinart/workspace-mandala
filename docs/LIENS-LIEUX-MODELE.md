# Liens entre lieux — modèle de données (préparation Suite)

> **Statut :** proposition alignée Suite · 2026-11-01  
> **Ordre produit :** Porte → Relier → Accepter → Dates « Ailleurs »  
> **Vocabulaire écran :** `docs/VOCABULAIRE.md` (lien, lieu ami — pas Prairie)

## Constat

- `mdl_mandala_communities` + `mdl_mandala_community_members` : lieux isolés.
- Aucune table « lien entre deux communautés » aujourd’hui.
- Feature doors : seul précédent proche = env `MANDALA_BILLING_PUBLIC` (billing). La Suite demande des portes **en base** (admin UI).

## 1. Portes des fonctions

```sql
-- Une ligne par clé de fonction
CREATE TABLE mdl_mandala_feature_doors (
  feature_key VARCHAR(64) NOT NULL PRIMARY KEY,
  -- administrateurs | gestionnaires | everyone
  audience ENUM('administrateurs','gestionnaires','everyone') NOT NULL DEFAULT 'administrateurs',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT NULL
);

-- Personnes nommées (en plus de l’audience, ou seule liste si on l’utilise comme allowlist)
CREATE TABLE mdl_mandala_feature_door_users (
  feature_key VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (feature_key, user_id)
);
```

Clés v1 : `lieux_lies`, `seuil`, `carte_membres`, `aide_contextuelle`  
(+ plus tard `billing_lieu` / `billing_pro` si on unifie avec l’env).

**Résolution serveur** (ordre) :

1. Admin app → toujours true  
2. Sinon user dans `feature_door_users` → true  
3. Sinon `audience` :
   - `administrateurs` → false (déjà couvert en 1)
   - `gestionnaires` → true si organizer/admin d’**au moins un** lieu
   - `everyone` → true si connecté  
4. Défaut si ligne absente → `administrateurs` (rien de visible)

Porte fermée = comportement actuel inchangé pour les autres.

## 2. Lien entre lieux (Relier + Accepter)

Une arête **non orientée** une fois acceptée ; **orientée** pendant la proposition.

```sql
CREATE TABLE mdl_mandala_place_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Toujours stocker low_id < high_id pour unicité du couple une fois accepted
  community_a_id INT NOT NULL,
  community_b_id INT NOT NULL,
  -- Qui a proposé (côté initiateur)
  requested_by_community_id INT NOT NULL,
  requested_by_user_id INT NOT NULL,
  status ENUM('pending','accepted','rejected','canceled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  responded_by_user_id INT NULL,
  UNIQUE KEY uq_pair (community_a_id, community_b_id),
  KEY idx_status (status),
  KEY idx_requested (requested_by_community_id, status)
);
```

Règles :

- À la création : `community_a_id = min(id1,id2)`, `community_b_id = max(...)`, `requested_by_community_id` = lieu du gestionnaire qui clique « Relier ».
- Un seul lien pending/accepted par paire.
- Gestionnaire du **lieu cible** (pas celui qui a demandé) accepte / refuse → notif existante (`type` dédié, actions Accepter / Refuser).
- « Lieu ami » = `status = 'accepted'`.

Pas de page « Lieux amis » : lecture via carte + helpers `listFriendPlaceIds(communityId)`.

## 3. Ouverture événement / ressource (case Suite suivante)

Colonnes optionnelles (quand on y est) :

- `mdl_events.open_to_friend_places TINYINT(1) DEFAULT 0`
- équivalent sur ressources

Sans lien accepted, l’UI **n’affiche pas** la case.  
« Ailleurs » = événements des lieux amis avec flag ouvert, **hors** calendrier du lieu actif.

## 4. Ce que le modèle actuel accueille déjà

| Besoin | Déjà là | À ajouter |
|---|---|---|
| Lieux + gestionnaires | `communities`, `community_members.role` | — |
| Notifications Accepter/Refuser | `notifications` v2 | type + payload `place_link_id` |
| Carte lieux | geo / listed_public | traits = arêtes `accepted` filtrées par droits |
| Messages inter-lieux | canaux chat | canal nommé aux 2 lieux au 1er message (plus tard) |
| Feature doors | — | tables §1 |
| Lien lieux | — | `place_links` §2 |

## 5. Ordre d’implémentation recommandé

1. **Porte** (tables §1 + admin UI + `canAccessFeatureDoor(user, key)`)  
2. **Relier** (table §2 + bouton carte derrière `lieux_lies`)  
3. **Accepter** (notif + review)  
4. **Dates Ailleurs** (lecture events + flag ; calendrier inchangé)

Les tables §1 et §2 peuvent être créées dès la case Porte (place_links inutilisée tant que Relier n’est pas codé) — ou place_links seulement à Relier. Préférence : **portes seules** dans la case Porte ; **place_links** dans Relier (YAGNI).
