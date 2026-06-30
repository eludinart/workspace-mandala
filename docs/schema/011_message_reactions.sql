-- Mandala — réactions emoji sur les messages de la Clairière
-- Préfixe mdl_ appliqué côté app via DB_PREFIX

CREATE TABLE IF NOT EXISTS mdl_chat_message_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(16) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_message_user (message_id, user_id),
  INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
