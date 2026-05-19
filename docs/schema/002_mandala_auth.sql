-- Mandala — tables auth (préfixe mdl_)
-- Structure compatible WordPress (users / usermeta)

CREATE TABLE IF NOT EXISTS mdl_users (
  ID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_login VARCHAR(60) NOT NULL DEFAULT '',
  user_pass VARCHAR(255) NOT NULL DEFAULT '',
  user_nicename VARCHAR(50) NOT NULL DEFAULT '',
  user_email VARCHAR(100) NOT NULL DEFAULT '',
  user_url VARCHAR(100) NOT NULL DEFAULT '',
  user_registered DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
  user_activation_key VARCHAR(255) NOT NULL DEFAULT '',
  user_status INT NOT NULL DEFAULT 0,
  display_name VARCHAR(250) NOT NULL DEFAULT '',
  PRIMARY KEY (ID),
  KEY user_login_key (user_login),
  KEY user_nicename (user_nicename),
  KEY user_email (user_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_usermeta (
  umeta_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  meta_key VARCHAR(255) DEFAULT NULL,
  meta_value LONGTEXT,
  PRIMARY KEY (umeta_id),
  KEY user_id (user_id),
  KEY meta_key (meta_key(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_app_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  app_role VARCHAR(32) NOT NULL DEFAULT 'user',
  PRIMARY KEY (user_id),
  KEY idx_app_role (app_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
