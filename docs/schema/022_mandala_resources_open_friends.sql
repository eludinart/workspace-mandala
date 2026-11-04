-- Ressources ouvertes aux lieux amis — Suite Mandala
-- Colonne aussi assurée au runtime via ensureOpenToFriendPlacesColumn.

ALTER TABLE mdl_mandala_resources
  ADD COLUMN open_to_friend_places TINYINT(1) NOT NULL DEFAULT 0;
