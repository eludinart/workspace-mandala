-- Annonces importantes du lieu (accueil — hors événements)

CREATE TABLE IF NOT EXISTS mdl_mandala_place_announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  author_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_data MEDIUMTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_community_created (community_id, created_at DESC),
  KEY idx_author (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
