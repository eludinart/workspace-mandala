# Design — Images sur retours (?) + multi-suppression admin

Date : 2026-11-08  
Statut : accepted · implémentation

## Problème

Les retours (question / bug) via le bouton **?** sont texte seul. Sans capture d’écran, l’admin peine à comprendre le bug. L’historique traité se vide unitaire, trop lent pour nettoyer plusieurs retours corrigés.

## Décision

1. **Jusqu’à 3 images** optionnelles (question **et** bug), data URLs JPEG compressées côté client (modèle Agora), stockées en MariaDB.
2. **Admin → Retours** : miniatures + lightbox ; multi-sélection + suppression **uniquement** sur les retours **Traité**.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Fichiers sur volume Coolify | Backups / permissions / chemins plus fragiles |
| S3 / R2 | Nouveau service hors besoin actuel |
| 1 seule image | Trop juste pour un bug multi-écrans |
| Multi-suppression tous statuts | Risque d’effacer un bug encore ouvert |

## Données & API

- Table `mdl_support_report_images` : `id`, `report_id`, `sort_order` (0–2), `image_data` MEDIUMTEXT, `created_at`.
- Créée au runtime (`ensureSupportImagesTable`) + script `docs/schema/024_mandala_support_images.sql`.
- `POST /api/support` : `images?: string[]` (0–3). Validation : `data:image/`, longueur plafonnée (~420k chars ≈ 300 Ko). Texte toujours ≥ 8 caractères.
- `GET /api/support` : chaque item expose `images: string[]`.
- `DELETE /api/support` (admin) : body `{ ids: number[] }` — **tout ou rien** ; refuse si un ID n’est pas `done`. Cascade images.
- Suppression unitaire existante : cascade images aussi.

## UI utilisateur (HelpButton)

- Onglet Signaler : Joindre / coller / drop, max 3 miniatures + retirer.
- Compression **sans crop** (fit max dimension, ratio conservé) — captures lisibles.
- Images optionnelles ; états Préparation… / Envoi… ; erreurs claires.

## UI admin (AdminSupportTab)

- Miniatures sous le message ; clic → lightbox.
- Historique Traité : checkboxes, tout sélectionner, barre **Supprimer la sélection (N)** + confirmation.
- Bouton Supprimer unitaire conservé.

## Hors scope

- Export ZIP, multi-suppression Nouveau/Lu, stockage objet externe.
