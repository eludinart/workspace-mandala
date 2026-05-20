-- Photos événements (couverture + galerie)

ALTER TABLE mdl_events
  ADD COLUMN IF NOT EXISTS cover_image MEDIUMTEXT NULL;

CREATE TABLE IF NOT EXISTS mdl_event_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  image_data MEDIUMTEXT NOT NULL,
  caption VARCHAR(255) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event (event_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_app_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ts DATETIME(3) NOT NULL,
  event_name VARCHAR(80) NOT NULL,
  user_id BIGINT NULL,
  anon_id VARCHAR(64) NULL,
  path VARCHAR(255) NULL,
  feature VARCHAR(64) NULL,
  env VARCHAR(24) NULL,
  properties_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ts (ts),
  KEY idx_event_ts (event_name, ts),
  KEY idx_user_ts (user_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
