-- Mandala — Play Store readiness : légal, signalements UGC, blocages, Play Billing
-- Préfixe typique : mdl_
-- Aussi créé au runtime (ensureLegalTables / ensureModerationTables / ensureBillingTables).

CREATE TABLE IF NOT EXISTS mdl_legal_acceptances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  doc_key VARCHAR(32) NOT NULL,
  doc_version VARCHAR(32) NOT NULL,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(64) DEFAULT NULL,
  user_agent VARCHAR(512) DEFAULT NULL,
  UNIQUE KEY uq_user_doc_version (user_id, doc_key, doc_version),
  KEY idx_user_doc (user_id, doc_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_content_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT UNSIGNED NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  target_user_id BIGINT UNSIGNED DEFAULT NULL,
  community_id INT DEFAULT NULL,
  reason_code VARCHAR(40) NOT NULL,
  details TEXT DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  reviewed_at DATETIME DEFAULT NULL,
  reviewer_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status_created (status, created_at),
  KEY idx_reporter (reporter_id),
  KEY idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_user_blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  KEY idx_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Colonnes Play Billing (idempotent)
ALTER TABLE mdl_mandala_billing_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(16) NOT NULL DEFAULT 'stripe';

ALTER TABLE mdl_mandala_billing_subscriptions
  ADD COLUMN IF NOT EXISTS play_purchase_token VARCHAR(512) NULL;

ALTER TABLE mdl_mandala_billing_subscriptions
  ADD COLUMN IF NOT EXISTS play_order_id VARCHAR(128) NULL;

CREATE TABLE IF NOT EXISTS mdl_play_billing_purchases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  plan_family ENUM('place','pro') NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  community_id INT NULL DEFAULT NULL,
  purchase_token VARCHAR(512) NOT NULL,
  order_id VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  raw_json MEDIUMTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_play_token (purchase_token(191)),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
