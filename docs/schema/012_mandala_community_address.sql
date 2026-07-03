-- Adresse structurée des lieux (géolocalisation précise sur la carte publique)
ALTER TABLE mdl_mandala_communities
  ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(24) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS city VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country VARCHAR(80) DEFAULT NULL;
