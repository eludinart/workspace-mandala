-- Visibilité publique des lieux (gestionnaires)

ALTER TABLE mdl_mandala_communities
  ADD COLUMN listed_public TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN profile_public TINYINT(1) NOT NULL DEFAULT 1;
