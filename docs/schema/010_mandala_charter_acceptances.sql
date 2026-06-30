-- Acceptation de la charte par membre et par lieu (empreinte pour re-validation si charte modifiée)
CREATE TABLE IF NOT EXISTS mdl_mandala_charter_acceptances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  user_id INT NOT NULL,
  charter_hash VARCHAR(32) NOT NULL,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_community (user_id, community_id),
  KEY idx_community (community_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
