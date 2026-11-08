-- Captures jointes aux retours (bouton ?).
-- Préfixe typique : mdl_
-- Aussi créée au runtime (ensureSupportImagesTable).

CREATE TABLE IF NOT EXISTS mdl_support_report_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  sort_order TINYINT NOT NULL DEFAULT 0,
  image_data MEDIUMTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_sort (report_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
