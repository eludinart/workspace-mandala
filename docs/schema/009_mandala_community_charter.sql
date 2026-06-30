-- Charte du lieu (contenu riche JSON : titres, paragraphes, listes, images)
ALTER TABLE mdl_mandala_communities
  ADD COLUMN IF NOT EXISTS charter LONGTEXT DEFAULT NULL;
