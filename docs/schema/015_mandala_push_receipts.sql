-- Accusés Web Push (sends + receipts) — préfixe typique : mdl_
-- Les tables sont aussi créées/migrées au runtime via ensurePushTables().

CREATE TABLE IF NOT EXISTS mdl_push_sends (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  notification_id INT NULL,
  user_id INT NOT NULL,
  subscription_id INT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status ENUM('accepted', 'gone', 'error') NOT NULL,
  error_detail VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_notif (notification_id),
  INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_push_receipts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  send_id BIGINT NOT NULL,
  event ENUM('delivered', 'opened') NOT NULL,
  user_agent VARCHAR(512) NULL,
  platform VARCHAR(16) NULL,
  standalone TINYINT(1) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_send_event (send_id, event),
  INDEX idx_event_created (event, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Colonnes optionnelles sur abonnements (ALTER IF NOT EXISTS selon MariaDB)
-- ALTER TABLE mdl_push_subscriptions ADD COLUMN platform VARCHAR(16) NULL;
-- ALTER TABLE mdl_push_subscriptions ADD COLUMN standalone TINYINT(1) NULL;
-- ALTER TABLE mdl_push_subscriptions ADD COLUMN last_seen_at DATETIME NULL;
