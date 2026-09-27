-- Questions et signalements de bugs envoyés depuis le bouton d'aide.
-- Préfixe typique : mdl_
-- La table est aussi créée au runtime (ensureSupportTable).

CREATE TABLE IF NOT EXISTS mdl_support_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  community_slug VARCHAR(64) DEFAULT NULL,
  page VARCHAR(64) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  user_agent VARCHAR(512) DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status_created (status, created_at),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
