-- Portes des fonctions (feature doors) — Suite Mandala

CREATE TABLE IF NOT EXISTS mdl_mandala_feature_doors (
  feature_key VARCHAR(64) NOT NULL PRIMARY KEY,
  audience ENUM('administrateurs','gestionnaires','everyone') NOT NULL DEFAULT 'administrateurs',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_feature_door_users (
  feature_key VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (feature_key, user_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO mdl_mandala_feature_doors (feature_key, audience) VALUES
  ('lieux_lies', 'administrateurs'),
  ('seuil', 'administrateurs'),
  ('carte_membres', 'administrateurs'),
  ('aide_contextuelle', 'administrateurs');
