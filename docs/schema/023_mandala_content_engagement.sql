-- Mandala — réactions + commentaires sur contenus mur (événements, Agora, annonces)
-- Préfixe mdl_ appliqué côté app via DB_PREFIX ; ce fichier documente les noms physiques.

CREATE TABLE IF NOT EXISTS mdl_content_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_kind VARCHAR(24) NOT NULL,
  target_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(16) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_content_user (target_kind, target_id, user_id),
  KEY idx_content (target_kind, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_content_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_kind VARCHAR(24) NOT NULL,
  target_id INT NOT NULL,
  author_id INT NOT NULL,
  body TEXT NOT NULL,
  parent_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_content_created (target_kind, target_id, created_at),
  KEY idx_author (author_id),
  KEY idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO mdl_mandala_feature_doors (feature_key, audience) VALUES
  ('mur_engagement', 'administrateurs');
