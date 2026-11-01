-- Billing Mandala : customers, subscriptions, Mandala Pro profiles, webhook idempotence

ALTER TABLE mdl_mandala_communities
  ADD COLUMN IF NOT EXISTS billing_partner TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE mdl_mandala_communities
  ADD COLUMN IF NOT EXISTS billing_featured TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mdl_mandala_billing_customers (
  user_id INT NOT NULL PRIMARY KEY,
  stripe_customer_id VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stripe_customer (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_billing_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  community_id INT NULL DEFAULT NULL,
  plan_family ENUM('place','pro') NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'none',
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_price_id VARCHAR(255) NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stripe_sub (stripe_subscription_id),
  KEY idx_user_family (user_id, plan_family),
  KEY idx_community (community_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_pro_profiles (
  user_id INT NOT NULL PRIMARY KEY,
  verification ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  tagline VARCHAR(200) NULL,
  modalities TEXT NULL,
  service_area VARCHAR(200) NULL,
  external_url VARCHAR(500) NULL,
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,
  reviewer_id INT NULL,
  endorsement_community_id INT NULL,
  reject_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_stripe_webhook_events (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
