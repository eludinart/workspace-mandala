# Design — Photos fiche membre (portrait + galerie)

Date : 2026-11-11  
Statut : accepted · implémentation

## Problème

Une fiche membre n’a qu’une photo d’avatar. On veut jusqu’à **3 photos** : 1 portrait (photo de la personne) + jusqu’à 2 photos ambiance / activité, éditables au Compte et visibles sur la fiche compétences selon le même scope.

## Décision

**Approche 1** — Portrait = `mdl_avatar` existant ; galerie = table `mdl_user_gallery_images` (max 2).

- Édition : Compte → Profil.
- Affichage : avatar partout (chat, annuaires…) ; galerie uniquement sur fiche compétences ouverte.
- Portrait **requis** seulement si skills `scope` ∈ {`mandala`, `places`} ; `hidden` → emoji / sans photo OK.
- Visibilité galerie = même règle que la fiche compétences.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Table unique `mdl_user_photos` | Migration + sync avatar, plus de travail |
| Photos uniquement côté skills | Contredit édition Compte + avatar partout |
| Fichiers volume / S3 | Hors besoin ; suite déjà notée pour plus tard |

## Données & API

- Portrait : usermeta `mdl_avatar` + `mdl_avatar_emoji` (inchangé).
- Table `mdl_user_gallery_images` : `id`, `user_id`, `sort_order` (0–1), `image_data` MEDIUMTEXT, `created_at`.
- Runtime `ensureUserGalleryImagesTable` + `docs/schema/026_mandala_user_gallery_images.sql`.
- `GET/POST /api/account/profile` : `gallery_images` (0–2 data URLs). POST remplace toute la galerie. Réponse POST sans renvoyer les data URLs (comme avatar → `has_avatar` / `has_gallery`).
- APIs fiche compétences : exposent `gallery_images` si le viewer peut voir la fiche.
- Validation : `data:image/(jpeg|png|webp)`, ~150 Ko décodé / image.
- Save skills vers scope public sans avatar → erreur. Retrait portrait au Compte si scope public → erreur.

## UI

- Compte : bloc Portrait + bloc Ambiance (0–2 miniatures, ajouter / retirer / réordonner).
- Fiche compétences : portrait cliquable (lightbox plein écran) + rail 0–2 photos + lightbox. Les lightbox montent en portal sur `document.body` (au-dessus du chrome). Pas de galerie sur cartes listes.

## Hors scope

- Crop visage, modération auto, stockage hors MariaDB, galerie fiche admin seule.
