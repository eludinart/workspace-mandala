-- Migration notifications V1 (003_mandala_social) → V2 (app Mandala)
-- Exécuter sur la base Mandala si erreur "Unknown column 'n.action_url'"

ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS body TEXT DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS action_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS action_label VARCHAR(80) DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(20) NOT NULL DEFAULT 'all';
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS recipient_id INT DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(40) DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal';
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS source_type VARCHAR(40) DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS source_id INT DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS channel_id INT DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS created_by INT DEFAULT NULL;
ALTER TABLE mdl_notifications ADD COLUMN IF NOT EXISTS expires_at DATETIME DEFAULT NULL;
-- V1 (003) : user_id obligatoire sur la ligne notification — optionnel pour le modèle broadcast V2
ALTER TABLE mdl_notifications MODIFY COLUMN user_id INT NULL DEFAULT NULL;

ALTER TABLE mdl_notification_deliveries ADD COLUMN IF NOT EXISTS user_email VARCHAR(255) DEFAULT NULL;
ALTER TABLE mdl_notification_deliveries ADD COLUMN IF NOT EXISTS channel_id INT DEFAULT NULL;
ALTER TABLE mdl_notification_deliveries ADD COLUMN IF NOT EXISTS delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP;
