-- Retours après une présence déclarée : lieu, événement, moment entre deux personnes.
-- Préfixe typique : mdl_
-- Les tables sont aussi créées au runtime (ensureReturnTables).

CREATE TABLE IF NOT EXISTS mdl_return_opt_ins (
  user_id INT NOT NULL PRIMARY KEY,
  is_open TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_accompaniments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  event_id INT NOT NULL DEFAULT 0,
  occasion_date DATE NOT NULL,
  occasion_label VARCHAR(200) NOT NULL,
  beneficiary_user_id INT NOT NULL,
  companion_user_id INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  UNIQUE KEY uk_pair_day (beneficiary_user_id, companion_user_id, community_id, event_id, occasion_date),
  KEY idx_companion_status (companion_user_id, status),
  KEY idx_beneficiary (beneficiary_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_id INT NOT NULL,
  target_type VARCHAR(16) NOT NULL,
  community_id INT NOT NULL,
  event_id INT NOT NULL DEFAULT 0,
  accompaniment_id INT NOT NULL DEFAULT 0,
  subject_user_id INT NOT NULL DEFAULT 0,
  occasion_date DATE NOT NULL,
  occasion_label VARCHAR(200) NOT NULL,
  clarity TINYINT NOT NULL,
  frame TINYINT NOT NULL,
  quality TINYINT NOT NULL,
  recommend TINYINT(1) NOT NULL,
  body VARCHAR(1000) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  reply_body VARCHAR(1000) NULL,
  reply_at DATETIME NULL,
  reply_user_id INT NULL,
  UNIQUE KEY uk_one (author_id, target_type, community_id, event_id, accompaniment_id, occasion_date),
  KEY idx_place (community_id, target_type, status),
  KEY idx_event (event_id, status),
  KEY idx_subject (subject_user_id, status),
  KEY idx_accomp (accompaniment_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_return_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_id INT NOT NULL,
  reporter_id INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status, created_at),
  KEY idx_return (return_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_frame_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  community_id INT NOT NULL,
  about_user_id INT NOT NULL DEFAULT 0,
  message VARCHAR(2000) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
