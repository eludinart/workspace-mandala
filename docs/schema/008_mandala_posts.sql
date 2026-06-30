-- L'Agora — brèves communautaires (logistique / inspiration)

CREATE TABLE IF NOT EXISTS mdl_mandala_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  author_id INT NOT NULL,
  type VARCHAR(24) NOT NULL DEFAULT 'inspiration',
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_community_created (community_id, created_at DESC),
  KEY idx_author (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
