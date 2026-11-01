-- Événements ouverts aux lieux amis (lecture « Ailleurs ») — Suite Mandala
-- Colonne aussi assurée au runtime via ensureOpenToFriendPlacesColumn.

ALTER TABLE mdl_events
  ADD COLUMN open_to_friend_places TINYINT(1) NOT NULL DEFAULT 0;
