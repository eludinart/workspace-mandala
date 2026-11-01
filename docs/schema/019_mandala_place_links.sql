-- Liens entre lieux (Relier / lieux amis) — Suite Mandala

CREATE TABLE IF NOT EXISTS mdl_mandala_place_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  community_a_id INT NOT NULL,
  community_b_id INT NOT NULL,
  requested_by_community_id INT NOT NULL,
  requested_by_user_id INT NOT NULL,
  status ENUM('pending','accepted','rejected','canceled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  responded_by_user_id INT NULL,
  UNIQUE KEY uq_pair (community_a_id, community_b_id),
  KEY idx_status (status),
  KEY idx_requested (requested_by_community_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
