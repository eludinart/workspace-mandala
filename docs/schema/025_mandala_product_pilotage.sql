-- Pilotage produit : events append-only + sessions journalières (DAU)
-- Préfixe typique : mdl_

CREATE TABLE IF NOT EXISTS mdl_product_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NULL,
  community_id INT UNSIGNED NULL,
  payload_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_type_created (event_type, created_at),
  KEY idx_user_created (user_id, created_at),
  KEY idx_community_created (community_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_user_session_days (
  user_id INT UNSIGNED NOT NULL,
  day_paris DATE NOT NULL,
  first_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day_paris),
  KEY idx_day (day_paris)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
