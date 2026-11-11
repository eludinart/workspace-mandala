-- Photos d'ambiance / activité sur fiche membre (hors portrait mdl_avatar).
-- Préfixe typique : mdl_
-- Aussi créée au runtime (ensureUserGalleryImagesTable).

CREATE TABLE IF NOT EXISTS mdl_user_gallery_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sort_order TINYINT NOT NULL DEFAULT 0,
  image_data MEDIUMTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sort (user_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
