-- Mandala — schéma minimal (préfixe mdl_ si DB_PREFIX=mdl_)
-- Adapter le préfixe si vous utilisez un autre DB_PREFIX.

-- Communautés (créées aussi par db-communities.ts au runtime)
CREATE TABLE IF NOT EXISTS mdl_mandala_communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  tagline VARCHAR(255) DEFAULT NULL,
  accent_color VARCHAR(24) DEFAULT NULL,
  logo_emoji VARCHAR(16) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mdl_mandala_community_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_community_user (community_id, user_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO mdl_mandala_communities (slug, name, tagline, accent_color, logo_emoji) VALUES
  ('shambhala', 'Shambhala', 'Lieu cœur — Inde', '#d97706', '🕉️'),
  ('sivana', 'Sivanà', 'Communauté Sivanà', '#7c3aed', '🌸');

-- Tables users WordPress-style : créées par db-auth au premier register si absentes
-- Voir Fleur db-auth pour mdl_users, mdl_usermeta, mdl_mandala_app_roles
