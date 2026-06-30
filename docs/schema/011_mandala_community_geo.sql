-- Position GPS des lieux (carte grand public)
ALTER TABLE mdl_mandala_communities
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6) DEFAULT NULL;
