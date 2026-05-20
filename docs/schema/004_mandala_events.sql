-- Mandala — événements par communauté (phases, équipe, tâches)

CREATE TABLE IF NOT EXISTS mdl_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(255) DEFAULT NULL,
  starts_at DATETIME DEFAULT NULL,
  ends_at DATETIME DEFAULT NULL,
  phase VARCHAR(24) NOT NULL DEFAULT 'preparation',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_community_starts (community_id, starts_at),
  KEY idx_phase (phase)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_event_staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'volunteer',
  note VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_event_user (event_id, user_id),
  KEY idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_event_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  phase VARCHAR(24) NOT NULL DEFAULT 'preparation',
  title VARCHAR(255) NOT NULL,
  is_done TINYINT(1) NOT NULL DEFAULT 0,
  assignee_user_id INT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event_phase (event_id, phase, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
